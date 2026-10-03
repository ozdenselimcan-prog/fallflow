import { extractFields } from "@/lib/ai/case-extractor";
import { applyTurn, isInteractive, nextPending, type TurnResult } from "@/lib/ai/conversation";
import { heuristicExtract } from "@/lib/ai/heuristic";
import { siteConfig } from "@/lib/config/site";
import type { Store } from "@/lib/data/store";
import type { CaseSource, CaseStatus, DocumentKind, MessageChannel } from "@/lib/data/types";
import { deliverToCustomer } from "@/lib/integrations/outbound";
import { normalizePhone } from "./identity";
import { refreshCase, ensureUploadToken, uploadUrl } from "./case-ops";
import { chatDocumentPrompt } from "./messages";
import {
  appointmentCancelledText,
  appointmentPendingReviewText,
  appointmentRescheduleQueuedText,
  availabilityNotUnderstoodText,
  availabilityQuestion,
  findNextSlot,
  findSlotOnDate,
  formatSlot,
  fullyBookedText,
  looksLikeCancellation,
  noOverlapText,
  noSlotFoundText,
  notAWorkingDayText,
  parseAvailability,
  parseSpecificDate,
  ymdToDate,
} from "./scheduling";

export class SessionNotFoundError extends Error {}

export interface IntakeInput {
  companyId: string;
  /** Fall-ID (unratbare UUID) einer laufenden Unterhaltung, null bei der ersten Nachricht */
  sessionId: string | null;
  text: string;
  source: CaseSource;
  channel: MessageChannel;
  /** true = im Simulator erzeugt, nichts wird nach außen versendet */
  simulated?: boolean;
  /** Bekannte Absenderdaten (E-Mail-Adresse, Telefonnummer …) – gelten als beantwortet */
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
 * Verarbeitet eine Kundennachricht (Website-Chat, E-Mail): erkennt bekannte Angaben, fragt nur noch
 * relevante fehlende Angaben ab, hält Fallakte, Status, Dokumentenanforderung und Follow-ups aktuell.
 */
export async function processIntakeMessage(store: Store, input: IntakeInput): Promise<IntakeTurn> {
  const { companyId } = input;
  const [questions, settings, company, templates, serviceMessages] = await Promise.all([
    store.listQuestions(),
    store.getAssistant(),
    store.getCompany(),
    store.listDocumentTemplates(),
    store.listServiceMessages(),
  ]);
  const foerderOverrides = { energyCertificate: company.foerderEnergyCertificate, floorplan: company.foerderFloorplan };
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
  const turn: TurnResult = applyTurn({ questions, settings: turnSettings, fields: startFields, text: input.text, first, extracted, documents, channel: input.channel, foerderOverrides });

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

  // Terminfrage/-bestätigung laufen als eigener kleiner Dialog NACH Abschluss der Datenerfassung: Antwortet der
  // Kunde in diesem Zustand, ersetzt die Terminantwort die sonst übliche „liegt bereits vor“-Floskel.
  const priorApptStage = existing?.fields.apptStage ?? "";
  const inAppointmentFlow = priorApptStage === "ask" || priorApptStage === "proposed";

  // Antworten der KI: im Website-Chat erscheinen sie sofort im Fenster, in anderen Kanälen nur bei echtem Versand.
  const replies = inAppointmentFlow ? [] : [...turn.replies];
  // Eigenes Kontaktformular des Büros (falls hinterlegt): bei jeder neuen Anfrage zuerst mitschicken,
  // zusätzlich zu den normalen Erfassungsfragen – ersetzt sie nicht.
  if (first && company.contactFormUrl) replies.unshift(`Sie können Ihre Angaben optional auch über unser Kontaktformular einreichen: ${company.contactFormUrl}`);
  const label = (k: string) => questions.find((q) => q.key === k)?.label ?? k;
  // Verlauf nur bei Neuem: mehrere Angaben auf einmal erkannt bzw. eine neue Frage gestellt (keine Wiederholungen).
  if (turn.recognizedKeys.length > 1 || (first && turn.recognizedKeys.length > 0)) await store.addEvent(caseId, "answer", `KI hat erkannt: ${turn.recognizedKeys.map(label).join(", ")}`);
  if (turn.pendingKey && !turn.done && turn.pendingKey !== pendingBefore) await store.addEvent(caseId, "question", `KI fragt nach: ${label(turn.pendingKey)}`);
  if (turn.handoff) await store.addEvent(caseId, "handoff", "Kunde wünscht persönlichen Kontakt");
  if (turn.appointmentRequested) await store.addEvent(caseId, "appointment", "Kunde wünscht einen Termin");

  // Büro-Vorlagen (z. B. eine Vollmacht) automatisch mitschicken – entweder weil die passende Leistung bekannt ist,
  // oder weil die Vorlage als "bei jeder Anfrage mitschicken" markiert ist (z. B. eine Datenschutz-Einwilligung,
  // die jeder Kunde ausfüllen muss) – mit Download-Link (blanko) UND Upload-Link (zum Zurückschicken der
  // ausgefüllten Version), nicht als Anhang (funktioniert so auf allen Kanälen gleich). Vor refreshCase, damit
  // der Fall nicht in diesem Zug schon als "bereit zur Prüfung" gilt, obwohl gerade erst eine neue Vorlage
  // aussteht. Pro Fall nur einmal pro Vorlage.
  const matchingTemplates = [
    ...(turn.fields.service ? templates.filter((t) => t.service && t.service === turn.fields.service) : []),
    ...templates.filter((t) => t.alwaysInclude),
  ];
  const uniqueTemplates = [...new Map(matchingTemplates.map((t) => [t.id, t])).values()];
  if (uniqueTemplates.length) {
    const sentIds = new Set((await store.listTemplateDocuments(caseId)).map((td) => td.templateId));
    const pending = uniqueTemplates.filter((t) => !sentIds.has(t.id));
    if (pending.length) {
      const caseNow = (await store.getCase(caseId))!;
      const token = await ensureUploadToken(store, caseNow);
      for (const tpl of pending) {
        const downloadUrl = `${siteConfig.appUrl}/api/upload/${token}/template/${tpl.id}`;
        await store.saveTemplateDocument({ caseId, templateId: tpl.id, status: "sent", storagePath: "", aiNote: "", receivedAt: null });
        // Büro-eigener Nachrichtentext für diese Leistung (Einstellungen/Onboarding) ersetzt den Standardsatz, falls gepflegt.
        const customMessage = serviceMessages.find((m) => m.service === tpl.service)?.body.trim();
        replies.push(
          customMessage
            ? `${customMessage}\n\nDokument herunterladen: ${downloadUrl}\nAusgefüllt wieder hochladen: ${uploadUrl(token)}`
            : `Für Ihr Anliegen („${tpl.title}“) laden Sie sich bitte das Dokument herunter (${downloadUrl}), füllen es aus und laden es anschließend hier wieder hoch: ${uploadUrl(token)}`,
        );
        await store.addEvent(caseId, "document", `Vorlage automatisch an Kunden gesendet: ${tpl.title}`);
      }
    }
  }

  // Nachbereitung: Vollständigkeit, Status, automatische Dokumentenanforderung, Follow-ups.
  const refreshed = await refreshCase(store, caseId, {
    hint: turn.handoff ? "waiting" : "chat",
    autoRequestDocs: settings.autoReply && !turn.handoff,
  });
  const { checklist } = refreshed;

  let upload: UploadPrompt | null = null;
  // Nur klassische (vom Kunden angeforderte) Dokumentarten – Vorlagen-Rückläufer haben keinen festen
  // DocumentKind und laufen ausschließlich über den eigenen Upload-Seiten-Link oben.
  const openDocs = checklist.items.filter((i) => i.kind === "document" && i.required && !i.done && i.key.startsWith("doc:"));
  if (checklist.dataComplete && openDocs.length > 0 && settings.autoReply) {
    const token = await ensureUploadToken(store, refreshed.caseRecord);
    upload = {
      url: uploadUrl(token),
      items: checklist.items.filter((i) => i.kind === "document" && i.key.startsWith("doc:")).map((i) => ({ kind: i.key.replace("doc:", "") as DocumentKind, label: i.label, done: i.done, required: i.required })),
    };
    if (refreshed.requestedNow.length) replies.push(chatDocumentPrompt(openDocs.map((i) => i.key.replace("doc:", "") as DocumentKind)));
  }

  // Terminvorschlag: Sobald der Fall vollständig ist (oder der Kunde ausdrücklich einen Termin wünscht),
  // fragt die KI nach passenden Wochentagen ODER einem konkreten Datum, sucht selbstständig einen freien
  // Termin (unter Berücksichtigung bestehender Termine UND vom Büro im Kalender eingetragener Blocker) und
  // lässt ihn vom Team freigeben: Der Kunde erfährt das genaue Datum bewusst NICHT direkt von der KI,
  // erst wenn ein Mitarbeiter den Vorschlag im Kalender akzeptiert (oder selbst einen anderen Termin
  // wählt), geht die Terminbestätigung per Mail an den Kunden raus (siehe /api/appointments/[id]/accept
  // und .../decline).
  if (settings.appointmentBooking && !turn.handoff) {
    const stage = refreshed.caseRecord.fields.apptStage ?? "";
    const slotBase = { workingDays: settings.workingDays, slotStart: settings.slotStart, slotEnd: settings.slotEnd, slotMinutes: settings.slotMinutes, maxAppointmentsPerDay: settings.maxAppointmentsPerDay };

    const bookSlot = async (slot: Date, pendingText: string = appointmentPendingReviewText) => {
      await store.saveAppointment({ caseId, title: `Beratung ${refreshed.caseRecord.customerName}`, startsAt: slot.toISOString(), durationMin: settings.slotMinutes, notes: "Automatisch von der KI vorgeschlagen – wartet auf Freigabe durch das Team", status: "proposed" });
      await store.updateCase(caseId, { fields: { apptStage: "proposed" } });
      await store.addEvent(caseId, "appointment", `Termin vorgeschlagen, wartet auf Freigabe: ${formatSlot(slot)}`);
      replies.push(pendingText);
    };

    /** Versucht zuerst ein konkretes Datum, sonst einen Wochentag-Bereich aus dem Kundentext zu lesen und vorzuschlagen. Gibt zurück, ob etwas erkannt wurde. */
    const resolveAndPropose = async (text: string, pendingText: string = appointmentPendingReviewText): Promise<boolean> => {
      const existingAppts = await store.listAppointments();
      const specificDate = parseSpecificDate(text);
      if (specificDate) {
        const exact = findSlotOnDate(specificDate, { ...slotBase, existing: existingAppts });
        if (exact.reason === "ok" && exact.slot) {
          await bookSlot(exact.slot, pendingText);
          return true;
        }
        const info = exact.reason === "not_a_working_day" ? notAWorkingDayText(specificDate) : fullyBookedText(specificDate);
        const alt = findNextSlot({ ...slotBase, customerDays: settings.workingDays, existing: existingAppts, from: ymdToDate(specificDate) });
        if (alt) {
          await store.saveAppointment({ caseId, title: `Beratung ${refreshed.caseRecord.customerName}`, startsAt: alt.toISOString(), durationMin: settings.slotMinutes, notes: "Automatisch von der KI vorgeschlagen – wartet auf Freigabe durch das Team", status: "proposed" });
          await store.updateCase(caseId, { fields: { apptStage: "proposed" } });
          await store.addEvent(caseId, "appointment", `Wunschtermin nicht verfügbar, Alternative vorgeschlagen, wartet auf Freigabe: ${formatSlot(alt)}`);
          replies.push(`${info} ${pendingText}`);
        } else {
          await store.updateCase(caseId, { fields: { apptStage: "failed" } });
          replies.push(`${info} ${noSlotFoundText}`);
        }
        return true;
      }
      const days = parseAvailability(text);
      if (!days) return false;
      if (!days.some((d) => settings.workingDays.includes(d))) {
        // Keiner der genannten Tage ist überhaupt ein Bürotag – klar sagen, statt "nichts gefunden".
        await store.updateCase(caseId, { fields: { apptStage: "ask" } });
        replies.push(noOverlapText(settings.workingDays));
        return true;
      }
      const slot = findNextSlot({ ...slotBase, customerDays: days, existing: existingAppts });
      if (slot) await bookSlot(slot, pendingText);
      else {
        await store.updateCase(caseId, { fields: { apptStage: "failed" } });
        replies.push(noSlotFoundText);
      }
      return true;
    };

    // Kunde sagt einen bereits bestätigten Termin ab. Nur innerhalb eines bekannten, bereits laufenden
    // Falls (existing) – bei der allerersten Nachricht eines unbekannten Absenders ignoriert die KI das
    // bewusst, sonst könnte eine völlig fremde Mail fälschlich einen Termin canceln.
    const confirmedAppt = existing ? (await store.listAppointments()).find((a) => a.caseId === caseId && a.status === "confirmed") : undefined;
    if (existing && confirmedAppt && looksLikeCancellation(input.text)) {
      await store.deleteAppointment(confirmedAppt.id);
      await store.addEvent(caseId, "appointment", `Termin vom Kunden abgesagt: ${formatSlot(new Date(confirmedAppt.startsAt))}`);
      await store.updateCase(caseId, { fields: { apptStage: "ask" } });
      // Schlägt der Kunde in derselben Nachricht gleich einen neuen Termin vor, direkt weitersuchen
      // (wieder nur "vorgeschlagen", wartet erneut auf Freigabe durchs Team) statt extra nachzufragen.
      if (!(await resolveAndPropose(input.text, appointmentRescheduleQueuedText))) replies.push(appointmentCancelledText);
    } else if (stage === "ask") {
      if (!(await resolveAndPropose(input.text))) replies.push(availabilityNotUnderstoodText);
    } else if (stage === "" && (turn.appointmentRequested || turn.complete)) {
      await store.updateCase(caseId, { fields: { apptStage: "ask" } });
      replies.push(availabilityQuestion(settings.workingDays));
    }
    // stage "proposed"/"confirmed"/"failed": liegt beim Team bzw. ist bereits final – die KI sagt dazu nichts Neues mehr.
  }

  let delivered = true;
  let deliveryNote = "";
  // Website-Chat: jede Antwort eine eigene Sprechblase. E-Mail: alles in EINER Nachricht senden –
  // sonst bekäme der Kunde für einen einzigen Gesprächszug mehrere einzelne E-Mails.
  const outgoing = isInteractive(input.channel) ? replies : replies.length ? [replies.join("\n\n")] : [];
  for (const reply of outgoing) {
    const result = await deliverToCustomer({ companyId, channel: input.channel, email: turn.fields.email, phone: turn.fields.phone, text: reply, simulated: input.simulated });
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
  return `Anfrage über den Website-Chat eingegangen${suffix}`;
}

