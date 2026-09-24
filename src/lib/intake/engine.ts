import { extractFields } from "@/lib/ai/case-extractor";
import { applyTurn, nextPending, type TurnResult } from "@/lib/ai/conversation";
import { heuristicExtract } from "@/lib/ai/heuristic";
import type { Store } from "@/lib/data/store";
import type { CaseSource, CaseStatus, DocumentKind, MessageChannel } from "@/lib/data/types";
import { deliverToCustomer } from "@/lib/integrations/outbound";
import { normalizePhone } from "./identity";
import { refreshCase, ensureUploadToken, uploadUrl } from "./case-ops";
import { chatDocumentPrompt } from "./messages";

export class SessionNotFoundError extends Error {}

export interface IntakeInput {
  /** Fall-ID (unratbare UUID) einer laufenden Unterhaltung, null bei der ersten Nachricht */
  sessionId: string | null;
  text: string;
  source: CaseSource;
  channel: MessageChannel;
  /** true = im Simulator erzeugt, nichts wird nach außen versendet */
  simulated?: boolean;
  /** Bekannte Absenderdaten (E-Mail-Adresse, WhatsApp-Nummer …) – gelten als beantwortet */
  identity?: { email?: string; phone?: string; name?: string };
}

export interface UploadPrompt {
  url: string;
  items: { kind: DocumentKind; label: string; done: boolean; required: boolean }[];
}

export interface IntakeTurn {
  sessionId: string;
  replies: string[];
  quickReplies: string[];
  done: boolean;
  completeness: number;
  status: CaseStatus;
  fields: Record<string, string>;
  /** Wurden die Antworten wirklich beim Kunden zugestellt (Website-Chat) oder nur gespeichert? */
  delivered: boolean;
  deliveryNote: string;
  upload: UploadPrompt | null;
  /** true, wenn in diesem Zug ein neuer Fall angelegt wurde */
  created: boolean;
}

const SHORT_TEXT = 25;

/** Kurze Antworten („1987“, „Gas“) werten wir regelbasiert aus; nur längere Texte gehen an das KI-Modell. */
export async function extractForText(text: string): Promise<Record<string, string>> {
  return text.length > SHORT_TEXT ? (await extractFields(text)).fields : heuristicExtract(text);
}

/**
 * Verarbeitet eine Kundennachricht (Website-Chat, WhatsApp, E-Mail): erkennt bekannte Angaben, fragt nur noch
 * relevante fehlende Angaben ab, hält Fallakte, Status, Dokumentenanforderung und Follow-ups aktuell.
 */
export async function processIntakeMessage(store: Store, input: IntakeInput): Promise<IntakeTurn> {
  const [questions, settings] = await Promise.all([store.listQuestions(), store.getAssistant()]);
  const existing = input.sessionId ? await store.getCase(input.sessionId) : null;
  if (input.sessionId && !existing) throw new SessionNotFoundError();

  const first = !existing;
  const documents = existing ? await store.listDocuments(existing.id) : [];
  const extracted = settings.autoReply ? await extractForText(input.text) : {};

  const known: Record<string, string> = {};
  if (input.identity?.email) known.email = input.identity.email.toLowerCase();
  if (input.identity?.phone) known.phone = normalizePhone(input.identity.phone).display;
  if (input.identity?.name) known.name = input.identity.name;
  const startFields = existing?.fields ?? (settings.autoReply ? known : { ...known, description: input.text.slice(0, 1000) });

  const turnSettings = settings.autoReply ? settings : { ...settings, autoFollowUp: false };
  const pendingBefore = nextPending(questions, startFields)?.key ?? null;
  const turn: TurnResult = applyTurn({ questions, settings: turnSettings, fields: startFields, text: input.text, first, extracted, documents });

  const draft = {
    fields: turn.fields,
    customerName: turn.fields.name ?? existing?.customerName ?? "Unbekannt",
    service: turn.fields.service ?? existing?.service ?? "",
  };

  let caseId: string;
  if (existing) {
    caseId = existing.id;
    await store.updateCase(caseId, draft);
  } else {
    const created = await store.createCase({ ...draft, source: input.source, status: "NEW", assignedTo: null, summary: "" });
    caseId = created.id;
    await store.addEvent(caseId, "received", eventForSource(input.source, input.simulated));
  }

  const meta = { channel: input.channel, simulated: Boolean(input.simulated) };
  await store.addMessage(caseId, "user", input.text.slice(0, 2000), { ...meta, delivery: "delivered" });

  // Antworten der KI: im Website-Chat erscheinen sie sofort im Fenster, in anderen Kanälen nur bei echtem Versand.
  const replies = [...turn.replies];
  const label = (k: string) => questions.find((q) => q.key === k)?.label ?? k;
  // Verlauf nur bei Neuem: mehrere Angaben auf einmal erkannt bzw. eine neue Frage gestellt (keine Wiederholungen).
  if (turn.recognizedKeys.length > 1 || (first && turn.recognizedKeys.length > 0)) await store.addEvent(caseId, "answer", `KI hat erkannt: ${turn.recognizedKeys.map(label).join(", ")}`);
  if (turn.pendingKey && !turn.done && turn.pendingKey !== pendingBefore) await store.addEvent(caseId, "question", `KI fragt nach: ${label(turn.pendingKey)}`);
  if (turn.handoff) await store.addEvent(caseId, "handoff", "Kunde wünscht persönlichen Kontakt");
  if (turn.appointmentRequested) await store.addEvent(caseId, "appointment", "Kunde wünscht einen Termin");

  // Nachbereitung: Vollständigkeit, Status, automatische Dokumentenanforderung, Follow-ups.
  const refreshed = await refreshCase(store, caseId, {
    hint: turn.handoff ? "waiting" : "chat",
    autoRequestDocs: settings.autoReply && !turn.handoff,
  });
  const { checklist } = refreshed;

  let upload: UploadPrompt | null = null;
  const openDocs = checklist.items.filter((i) => i.kind === "document" && i.required && !i.done);
  if (checklist.dataComplete && openDocs.length > 0 && settings.autoReply) {
    const token = await ensureUploadToken(store, refreshed.caseRecord);
    upload = {
      url: uploadUrl(token),
      items: checklist.items.filter((i) => i.kind === "document").map((i) => ({ kind: i.key.replace("doc:", "") as DocumentKind, label: i.label, done: i.done, required: i.required })),
    };
    if (refreshed.requestedNow.length) replies.push(chatDocumentPrompt(openDocs.map((i) => i.key.replace("doc:", "") as DocumentKind)));
  }

  let delivered = true;
  let deliveryNote = "";
  for (const reply of replies) {
    const result = await deliverToCustomer({ channel: input.channel, email: turn.fields.email, phone: turn.fields.phone, text: reply, simulated: input.simulated });
    if (!result.delivered) {
      delivered = false;
      deliveryNote = result.reason;
    }
    await store.addMessage(caseId, "assistant", reply, { ...meta, delivery: result.delivered ? "delivered" : "not_sent" });
  }

  return {
    sessionId: caseId,
    replies,
    quickReplies: turn.quickReplies,
    done: turn.done,
    completeness: checklist.percent,
    status: refreshed.caseRecord.status,
    fields: turn.fields,
    delivered,
    deliveryNote,
    upload,
    created: first,
  };
}

function eventForSource(source: CaseSource, simulated?: boolean) {
  const suffix = simulated ? " (Simulation)" : "";
  if (source === "email") return `Anfrage per E-Mail eingegangen${suffix}`;
  if (source === "whatsapp") return `Anfrage per WhatsApp eingegangen${suffix}`;
  return `Anfrage über den Website-Chat eingegangen${suffix}`;
}

