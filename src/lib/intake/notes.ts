import { ATTENTION_KEY, attentionOf } from "@/lib/cases/attention";
import { AI_PAUSED_KEY } from "./engine";
import { extractFields, extractionContext } from "@/lib/ai/case-extractor";
import { heuristicExtract } from "@/lib/ai/heuristic";
import { isAnswered } from "@/lib/cases/completeness";
import { FIELD_GROUPS } from "@/lib/cases/fields";
import { deriveFields } from "./checklist";
import type { Store } from "@/lib/data/store";
import type { CaseMessage, MessageChannel } from "@/lib/data/types";
import { deliverToCustomer } from "@/lib/integrations/outbound";
import { inCustomerLanguage, LANGUAGE_NAMES } from "@/lib/ai/language";
import { refreshCase } from "./case-ops";

const SHORT_TEXT = 25;

/**
 * Telefonnotiz des Teams: wird im Fall gespeichert; erkannte Angaben (z. B. Baujahr, Heizung) werden in die
 * Fallakte übernommen, soweit sie dort noch fehlen – bestehende Angaben werden nie überschrieben.
 */
export async function addPhoneNote(store: Store, caseId: string, text: string): Promise<{ message: CaseMessage; added: string[] }> {
  const c = await store.getCase(caseId);
  if (!c) throw new Error("Fall nicht gefunden");
  const message = await store.addMessage(caseId, "staff", text, { channel: "phone", delivery: "internal" });

  const [company, allQuestions] = await Promise.all([store.getCompany(), store.listQuestions()]);
  const extracted = text.length > SHORT_TEXT ? (await extractFields(text, extractionContext(company, allQuestions))).fields : heuristicExtract(text);
  const additions: Record<string, string> = {};
  for (const [k, v] of Object.entries(extracted)) if (v && k !== "description" && !isAnswered(c.fields, k)) additions[k] = v;
  Object.assign(additions, deriveFields({ ...c.fields, ...additions }));

  const questions = allQuestions;
  const label = (k: string) => questions.find((q) => q.key === k)?.label ?? FIELD_GROUPS.flatMap((g) => g.fields).find((f) => f.key === k)?.label ?? k;
  const added = Object.keys(additions);
  if (added.length) await store.updateCase(caseId, { fields: additions });
  await store.addEvent(caseId, "note", added.length ? `Telefonnotiz gespeichert – übernommen: ${added.map(label).join(", ")}` : "Telefonnotiz gespeichert");
  await refreshCase(store, caseId, { hint: "edit", autoRequestDocs: true });
  return { message, added };
}

/** Nachricht des Teams an den Kunden (E-Mail bzw. WhatsApp, wenn der Kunde darüber kam). Wird nur als „gesendet“ markiert, wenn der Kanal wirklich versendet hat. */
export async function sendTeamMessage(
  store: Store,
  caseId: string,
  input: { channel: Extract<MessageChannel, "email">; text: string; subject?: string; translate?: boolean },
): Promise<{ message: CaseMessage; delivered: boolean; reason: string; translated: boolean }> {
  const c = await store.getCase(caseId);
  if (!c) throw new Error("Fall nicht gefunden");
  // Kam der Kunde per WhatsApp, geht die Antwort des Teams auch per WhatsApp raus.
  const channel: MessageChannel = c.source === "whatsapp" ? "whatsapp" : input.channel;
  // Kunde schreibt in einer anderen Sprache: Das Team schreibt Deutsch, raus geht die Übersetzung.
  const text = input.translate === false ? input.text : await inCustomerLanguage(c.fields, input.text);
  const translated = text !== input.text;
  const result = await deliverToCustomer({ companyId: c.companyId, channel, email: c.fields.email, phone: c.fields.phone, text, subject: input.subject });
  const message = await store.addMessage(caseId, "staff", text, { channel, delivery: result.delivered ? "delivered" : "not_sent" });
  await store.addEvent(caseId, "note", result.delivered ? "Nachricht an den Kunden gesendet" : "Nachricht gespeichert – nicht versendet (Kanal nicht verbunden)");
  // Antwortet das Team selbst im WhatsApp-Chat, hält sich die KI dort zurück, bis sie wieder eingeschaltet wird.
  if (result.delivered && channel === "whatsapp") await store.updateCase(caseId, { fields: { [AI_PAUSED_KEY]: "1" }, keepTimestamp: true });
  // Persönliche Antwort des Büros erledigt "Aufmerksamkeit benötigt".
  if (result.delivered && attentionOf(c.fields)) {
    await store.updateCase(caseId, { fields: { [ATTENTION_KEY]: "" }, keepTimestamp: true });
    await refreshCase(store, caseId, { hint: "waiting", touch: false });
  }
  if (translated) await store.addEvent(caseId, "note", `Nachricht übersetzt gesendet (${LANGUAGE_NAMES[c.fields.lang] ?? c.fields.lang}). Ihr Text: ${input.text.slice(0, 300)}`);
  return { message, delivered: result.delivered, reason: result.reason, translated };
}
