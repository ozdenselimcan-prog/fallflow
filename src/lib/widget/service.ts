import { extractFields } from "@/lib/ai/case-extractor";
import { applyTurn, type TurnResult } from "@/lib/ai/conversation";
import { buildSummary } from "@/lib/cases/completeness";
import type { Store } from "@/lib/data/store";
import type { CaseSource, CaseStatus } from "@/lib/data/types";

export class SessionNotFoundError extends Error {}

export interface WidgetTurn {
  sessionId: string;
  replies: string[];
  quickReplies: string[];
  done: boolean;
  completeness: number;
  fields: Record<string, string>;
}

const OPEN: CaseStatus[] = ["NEW", "NEEDS_INFO", "COMPLETE"];

function statusFor(turn: TurnResult, autoFollowUp: boolean, autoReply: boolean): CaseStatus {
  if (turn.complete) return "COMPLETE";
  if (!autoReply || !autoFollowUp) return "NEW";
  return "NEEDS_INFO";
}

/**
 * Verarbeitet eine Nutzernachricht im Chat (Widget oder Dashboard-Vorschau) und persistiert Fall,
 * Nachrichten und Ereignisse. sessionId = Fall-ID (unratbare UUID), null bei der ersten Nachricht.
 */
export async function processChatMessage(
  store: Store,
  input: { sessionId: string | null; text: string; source?: CaseSource },
): Promise<WidgetTurn> {
  const [questions, settings] = await Promise.all([store.listQuestions(), store.getAssistant()]);
  const existing = input.sessionId ? await store.getCase(input.sessionId) : null;
  if (input.sessionId && !existing) throw new SessionNotFoundError();

  const first = !existing;
  const extracted = first && settings.autoReply ? (await extractFields(input.text)).fields : {};

  let turn: TurnResult;
  if (!settings.autoReply) {
    turn = applyTurn({ questions, settings: { ...settings, autoFollowUp: false }, fields: existing?.fields ?? { description: input.text.slice(0, 1000) }, text: input.text, first, extracted });
  } else {
    turn = applyTurn({ questions, settings, fields: existing?.fields ?? {}, text: input.text, first, extracted });
  }

  const status = statusFor(turn, settings.autoFollowUp, settings.autoReply);
  const nextStatus = existing && !OPEN.includes(existing.status) ? existing.status : turn.handoff ? "NEEDS_INFO" : status;
  const patch = {
    fields: turn.fields,
    completeness: turn.completeness,
    customerName: turn.fields.name ?? existing?.customerName ?? "Unbekannt",
    service: turn.fields.service ?? "",
    summary: buildSummary(turn.fields),
    status: nextStatus,
  };

  let caseId: string;
  if (existing) {
    caseId = existing.id;
    await store.updateCase(caseId, patch);
  } else {
    const created = await store.createCase({ ...patch, source: input.source ?? "widget", assignedTo: null });
    caseId = created.id;
    await store.addEvent(caseId, "received", "Anfrage eingegangen");
    if (turn.pendingKey && !turn.done) await store.addEvent(caseId, "question", "KI hat Rückfrage gestellt");
  }

  await store.addMessage(caseId, "user", input.text.slice(0, 2000));
  for (const reply of turn.replies) await store.addMessage(caseId, "assistant", reply);

  if (existing) {
    const events = await store.listEvents(caseId);
    if (!events.some((e) => e.type === "answer")) await store.addEvent(caseId, "answer", "Kunde hat geantwortet");
  }
  if (turn.handoff) await store.addEvent(caseId, "handoff", "Kunde wünscht persönlichen Kontakt");
  if (turn.appointmentRequested) await store.addEvent(caseId, "appointment", "Kunde wünscht einen Termin");
  if (turn.complete && existing?.status !== "COMPLETE") await store.addEvent(caseId, "complete", "Fall vollständig");

  return { sessionId: caseId, replies: turn.replies, quickReplies: turn.quickReplies, done: turn.done, completeness: turn.completeness, fields: turn.fields };
}
