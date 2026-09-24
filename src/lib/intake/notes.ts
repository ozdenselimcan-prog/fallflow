import { extractFields } from "@/lib/ai/case-extractor";
import { heuristicExtract } from "@/lib/ai/heuristic";
import { isAnswered } from "@/lib/cases/completeness";
import { FIELD_GROUPS } from "@/lib/cases/fields";
import { deriveFields } from "./checklist";
import type { Store } from "@/lib/data/store";
import type { CaseMessage, MessageChannel } from "@/lib/data/types";
import { deliverToCustomer } from "@/lib/integrations/outbound";
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

  const extracted = text.length > SHORT_TEXT ? (await extractFields(text)).fields : heuristicExtract(text);
  const additions: Record<string, string> = {};
  for (const [k, v] of Object.entries(extracted)) if (v && k !== "description" && !isAnswered(c.fields, k)) additions[k] = v;
  Object.assign(additions, deriveFields({ ...c.fields, ...additions }));

  const questions = await store.listQuestions();
  const label = (k: string) => questions.find((q) => q.key === k)?.label ?? FIELD_GROUPS.flatMap((g) => g.fields).find((f) => f.key === k)?.label ?? k;
  const added = Object.keys(additions);
  if (added.length) await store.updateCase(caseId, { fields: additions });
  await store.addEvent(caseId, "note", added.length ? `Telefonnotiz gespeichert – übernommen: ${added.map(label).join(", ")}` : "Telefonnotiz gespeichert");
  await refreshCase(store, caseId, { hint: "edit", autoRequestDocs: true });
  return { message, added };
}

/** Nachricht des Teams an den Kunden (E-Mail/WhatsApp). Wird nur als „gesendet“ markiert, wenn der Kanal wirklich versendet hat. */
export async function sendTeamMessage(
  store: Store,
  caseId: string,
  input: { channel: Extract<MessageChannel, "email" | "whatsapp">; text: string },
): Promise<{ message: CaseMessage; delivered: boolean; reason: string }> {
  const c = await store.getCase(caseId);
  if (!c) throw new Error("Fall nicht gefunden");
  const result = await deliverToCustomer({ channel: input.channel, email: c.fields.email, phone: c.fields.phone, text: input.text });
  const message = await store.addMessage(caseId, "staff", input.text, { channel: input.channel, delivery: result.delivered ? "delivered" : "not_sent" });
  await store.addEvent(caseId, "note", result.delivered ? "Nachricht an den Kunden gesendet" : "Nachricht gespeichert – nicht versendet (Kanal nicht verbunden)");
  return { message, delivered: result.delivered, reason: result.reason };
}
