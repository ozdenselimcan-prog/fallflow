import { APPOINTMENT_LABEL, SKIP_LABEL_OPTIONAL, SKIP_LABEL_REQUIRED } from "@/lib/ai/conversation";
import { needsPaymentSetup } from "@/lib/billing/access";
import { attentionOf } from "@/lib/cases/attention";
import { phoneMinutesFor } from "@/lib/config/pricing";
import { siteConfig } from "@/lib/config/site";
import { getPublicStore } from "@/lib/data";
import type { Store } from "@/lib/data/store";
import { CaseLimitReachedError, processIntakeMessage, SessionNotFoundError } from "@/lib/intake/engine";
import { phoneRepo, type PhoneRepo } from "./calls";
import { e164, twiml, type TwimlPart } from "./twilio";

/**
 * Gesprächsablauf am Telefon: Twilio ruft bei jedem Anruf /api/phone/voice auf und nach jeder Antwort des Anrufers
 * /api/phone/turn (mit dem erkannten Text). Wir antworten mit TwiML – vorlesen und wieder zuhören. Inhaltlich läuft
 * jeder Satz durch dieselbe Verarbeitung wie Website-Chat und E-Mail (processIntakeMessage): Angaben erkennen, nur
 * Fehlendes nachfragen, Fall anlegen, Termin vorschlagen. Notfälle, Preisfragen o. Ä. landen beim Team.
 */

export interface CallParams {
  callSid: string;
  from: string;
  to: string;
  speech?: string;
  attempt?: number;
}

const UNAVAILABLE = "Unser Telefon-Assistent ist gerade leider nicht erreichbar. Bitte versuchen Sie es später noch einmal oder schreiben Sie uns eine E-Mail. Auf Wiederhören.";
const GOODBYE = "Vielen Dank für Ihren Anruf. Auf Wiederhören.";
const HANDOFF = "Vielen Dank, ich habe Ihr Anliegen notiert und gebe es sofort an das Team weiter. Wir rufen Sie so schnell wie möglich zurück. Auf Wiederhören.";

const turnUrl = (attempt = 0) => `${siteConfig.appUrl}/api/phone/turn${attempt ? `?attempt=${attempt}` : ""}`;
/** Anrufernummer nur übernehmen, wenn sie echt aussieht (nicht "anonymous" / unterdrückt). */
const callerNumber = (from: string) => (/^\+\d{8,15}$/.test(from) ? from : "");

async function companyContext(repo: PhoneRepo, to: string, callSid?: string): Promise<{ companyId: string; store: Store } | null> {
  const known = callSid ? await repo.getCall(callSid) : null;
  const companyId = known?.companyId ?? (await repo.companyForNumber(e164(to)));
  if (!companyId) return null;
  const store = await getPublicStore(companyId);
  return store ? { companyId, store } : null;
}

/** Anruf geht ein: Betrieb zur Nummer finden, prüfen, ob der Assistent annehmen darf, und begrüßen. */
export async function incomingCall(p: CallParams): Promise<string> {
  const repo = phoneRepo();
  if (!repo) return twiml([{ say: UNAVAILABLE }, { hangup: true }]);
  const ctx = await companyContext(repo, p.to);
  if (!ctx) return twiml([{ say: "Diese Nummer ist derzeit nicht vergeben. Auf Wiederhören." }, { hangup: true }]);
  const { companyId, store } = ctx;
  const [company, subscription, assistant] = await Promise.all([store.getCompany(), store.getSubscription(), store.getAssistant()]);
  if (subscription.status === "canceled" || needsPaymentSetup(company, subscription)) return twiml([{ say: UNAVAILABLE }, { hangup: true }]);
  const included = phoneMinutesFor(subscription.plan);
  // Telefon-Assistent erst ab Pro (Starter: 0 Minuten) – keine Zusatzminuten ohne Kontingent.
  if (included === 0 || (company.businessProfile.phoneStopAtLimit && (await repo.minutesThisMonth(companyId)) >= included)) {
    return twiml([{ say: UNAVAILABLE }, { hangup: true }]);
  }
  await repo.startCall({ callSid: p.callSid, companyId, fromNumber: callerNumber(p.from) });
  // KI-Hinweis (EU-KI-Verordnung): Der Anrufer muss wissen, dass er mit einer KI spricht. Es wird nichts aufgezeichnet.
  const greeting = `Guten Tag, hier ist ${assistant.name || "der digitale Assistent"} von ${company.name}. Ich bin eine künstliche Intelligenz und nehme Ihr Anliegen auf, das Gespräch wird nicht aufgezeichnet. Worum geht es bei Ihnen?`;
  return twiml([{ gather: { action: turnUrl(), prompt: greeting, hints: company.services } }]);
}

/** Der Anrufer hat etwas gesagt (oder geschwiegen): verarbeiten und die nächste Frage stellen bzw. verabschieden. */
export async function callTurn(p: CallParams): Promise<string> {
  const repo = phoneRepo();
  if (!repo) return twiml([{ say: UNAVAILABLE }, { hangup: true }]);
  const ctx = await companyContext(repo, p.to, p.callSid);
  if (!ctx) return twiml([{ say: UNAVAILABLE }, { hangup: true }]);
  const { companyId, store } = ctx;
  const company = await store.getCompany();
  const speech = (p.speech ?? "").trim();
  const attempt = p.attempt ?? 0;

  if (!speech) {
    if (attempt >= 2) return twiml([{ say: `Ich kann Sie leider nicht verstehen. ${GOODBYE}` }, { hangup: true }]);
    return twiml([{ gather: { action: turnUrl(attempt + 1), prompt: "Entschuldigung, das habe ich nicht verstanden. Können Sie das bitte noch einmal sagen?", hints: company.services } }]);
  }

  await repo.startCall({ callSid: p.callSid, companyId, fromNumber: callerNumber(p.from) });
  const call = await repo.getCall(p.callSid);
  const phone = callerNumber(p.from);
  const run = (sessionId: string | null) =>
    processIntakeMessage(store, { companyId, sessionId, text: speech.slice(0, 1500), source: "phone", channel: "phone", identity: phone ? { phone } : undefined });

  let turn;
  try {
    turn = await run(call?.caseId ?? null);
  } catch (err) {
    if (err instanceof SessionNotFoundError) turn = await run(null);
    else if (err instanceof CaseLimitReachedError) return twiml([{ say: UNAVAILABLE }, { hangup: true }]);
    else throw err;
  }
  if (!call?.caseId || turn.created) await repo.setCase(p.callSid, turn.sessionId);

  // Aktueller Stand des Falls (Aufmerksamkeit und Terminschritt stehen nur dort, nicht im Gesprächszug).
  const fields = (await store.getCase(turn.sessionId))?.fields ?? turn.fields;
  // Notfall, Preisfrage, Rückrufwunsch o. Ä.: Das Team übernimmt.
  if (turn.replies.length === 0 || attentionOf(fields)) return twiml([{ say: HANDOFF }, { hangup: true }]);

  const said = turn.replies.join(" ");
  const askingForDays = fields.apptStage === "ask";
  if (turn.done && !askingForDays) return twiml([{ say: `${said} ${GOODBYE}` }, { hangup: true }]);

  // Auswahlfragen: Die Möglichkeiten mit vorlesen (im Chat sind es Knöpfe).
  const options = turn.quickReplies.filter((o) => o !== SKIP_LABEL_REQUIRED && o !== SKIP_LABEL_OPTIONAL && o !== APPOINTMENT_LABEL && o !== "Sonstiges");
  const optionText = options.length > 1 && options.length <= 8 ? ` Zum Beispiel: ${options.slice(0, -1).join(", ")} oder ${options.at(-1)}.` : "";
  return twiml([{ gather: { action: turnUrl(), prompt: `${said}${optionText}` || "Gibt es sonst noch etwas?", hints: [...company.services, ...options] } }]);
}

/** Anruf beendet (Status-Rückmeldung von Twilio): Dauer für das Minuten-Kontingent speichern. */
export async function callEnded(p: { callSid: string; status: string; durationSec: number }): Promise<void> {
  const repo = phoneRepo();
  if (!repo || !(await repo.getCall(p.callSid))) return;
  await repo.finishCall(p.callSid, p.status, p.durationSec);
}
