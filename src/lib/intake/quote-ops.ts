import { draftQuote } from "@/lib/ai/quote-draft";
import { knowledgeOf } from "@/lib/ai/knowledge";
import { FIELD_GROUPS } from "@/lib/cases/fields";
import { customerText } from "@/lib/config/customer-texts";
import type { Store } from "@/lib/data/store";
import type { CaseRecord } from "@/lib/data/types";
import { buildQuotePdf } from "@/lib/documents/quote-pdf";
import { deliverToCustomer } from "@/lib/integrations/outbound";
import { QUOTE_FIELD, quoteNumber, quoteTotals, readQuote, type Quote } from "@/lib/quote";
import { frameEmail } from "./case-ops";

/** Bekannte Angaben des Falls als Text für die KI (Bezeichnung: Wert). */
async function caseFacts(store: Store, c: CaseRecord): Promise<string> {
  const questions = await store.listQuestions();
  const label = (k: string) => questions.find((q) => q.key === k)?.label ?? FIELD_GROUPS.flatMap((g) => g.fields).find((f) => f.key === k)?.label ?? k;
  const skip = /^(name|email|phone|needsAttention|apptStage|quote|reminderCount|noResponse|clarifyAsked|serviceMessageSentFor|docsRequestedFor|contactChannel|aiPaused|extraServices)$/;
  return Object.entries(c.fields)
    .filter(([k, v]) => v && !skip.test(k))
    .map(([k, v]) => `${label(k)}: ${String(v).slice(0, 300)}`)
    .join("\n");
}

export async function draftQuoteFor(store: Store, c: CaseRecord): Promise<Quote | null> {
  const company = await store.getCompany();
  const draft = await draftQuote({ companyName: company.name, industry: company.businessProfile.industry, service: c.fields.service ?? "", facts: await caseFacts(store, c), knowledge: knowledgeOf(company.businessProfile) });
  if (!draft) return null;
  const existing = readQuote(c.fields);
  return { intro: draft.intro, items: draft.items, vatRate: existing?.vatRate ?? 19, validDays: existing?.validDays ?? 30, number: existing?.number || quoteNumber(c.id), sentAt: null };
}

export async function saveQuote(store: Store, c: CaseRecord, q: Quote): Promise<Quote> {
  const quote = { ...q, number: q.number || quoteNumber(c.id) };
  await store.updateCase(c.id, { fields: { [QUOTE_FIELD]: JSON.stringify(quote) }, keepTimestamp: true });
  return quote;
}

/** PDF des gespeicherten Angebots. */
export async function quotePdfFor(store: Store, c: CaseRecord): Promise<Uint8Array | null> {
  const quote = readQuote(c.fields);
  if (!quote) return null;
  const [company, channels] = await Promise.all([store.getCompany(), store.listChannels()]);
  const mailbox = channels.find((ch) => ch.kind === "gmail" && ch.status === "connected")?.account ?? "";
  return buildQuotePdf({
    company: { name: company.name, address: company.address, phone: company.phone, website: company.website, email: mailbox.includes("@") ? mailbox : "" },
    customer: { name: c.fields.name ?? c.customerName, street: c.fields.street ?? "", city: [c.fields.postalCode, c.fields.city].filter(Boolean).join(" ") },
    service: c.fields.service ?? "",
    quote,
    date: new Date(),
  });
}

/** Angebot per E-Mail mit PDF an den Kunden senden (nur vollständig – jede Position braucht einen Preis). */
export async function sendQuote(store: Store, c: CaseRecord): Promise<{ ok: true; delivered: boolean; reason: string } | { ok: false; message: string }> {
  const quote = readQuote(c.fields);
  if (!quote || !quote.items.length) return { ok: false, message: "Bitte zuerst Positionen anlegen und speichern." };
  if (!quoteTotals(quote).complete) return { ok: false, message: "Bitte bei allen Positionen einen Preis eintragen." };
  if (!c.fields.email) return { ok: false, message: "Für diesen Fall fehlt die E-Mail-Adresse des Kunden." };
  const pdf = await quotePdfFor(store, c);
  if (!pdf) return { ok: false, message: "Das PDF konnte nicht erstellt werden." };
  const texts = (await store.getCompany()).businessProfile.texts;
  const body = customerText(texts, "quote.email", { nummer: quote.number, leistung: c.fields.service || "Ihrer Anfrage" });
  const text = await frameEmail(store, body, c.fields.name);
  const result = await deliverToCustomer({
    companyId: c.companyId,
    channel: "email",
    email: c.fields.email,
    text,
    subject: `Angebot ${quote.number}`,
    attachments: [{ filename: `Angebot-${quote.number}.pdf`, mime: "application/pdf", bytes: pdf }],
  });
  await store.addMessage(c.id, "staff", `${text}\n\n[Anhang: Angebot-${quote.number}.pdf]`, { channel: "email", delivery: result.delivered ? "delivered" : "not_sent" });
  if (result.delivered) await saveQuote(store, c, { ...quote, sentAt: new Date().toISOString() });
  await store.addEvent(c.id, "document", result.delivered ? `Angebot ${quote.number} an den Kunden gesendet` : `Angebot ${quote.number} vorbereitet (nicht versendet)`);
  return { ok: true, delivered: result.delivered, reason: result.reason };
}
