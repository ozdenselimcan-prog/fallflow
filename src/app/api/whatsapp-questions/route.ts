import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { normalizeWhatsAppQuestions, suggestWhatsAppQuestions } from "@/lib/ai/whatsapp-questions";
import type { Store } from "@/lib/data/store";
import { profileDocumentsFor } from "@/lib/data/types";
import { questionsOf } from "@/lib/intake/template-questions";

/** Angaben, die es schon gibt (Standard, Profil, Formulare) – ohne Name/Telefon/E-Mail/Leistung, die WhatsApp selbst klärt. */
async function knownFields(store: Store) {
  const [questions, templates] = await Promise.all([store.listQuestions(), store.listDocumentTemplates()]);
  const base = questions
    .filter((q) => !q.whatsappOnly && !["name", "phone", "email", "service", "description"].includes(q.key))
    .map((q) => ({ key: q.key, label: q.label, prompt: q.prompt, services: q.appliesTo }));
  const fromForms = [];
  for (const t of templates.filter((t) => t.requiresReturn !== false)) {
    for (const q of await questionsOf(store, t).catch(() => [])) fromForms.push({ ...q, services: t.alwaysInclude || !t.service ? [] : [t.service] });
  }
  return [...base, ...fromForms];
}

/** WhatsApp-Fragen des Betriebs (null = noch keine eigene Liste, dann gilt der normale Ablauf wie im Website-Chat). */
export const GET = withSession(async (_req, { store }) => {
  const company = await store.getCompany();
  return json({ questions: company.businessProfile.whatsappQuestions ?? null, services: company.services.filter((s) => s !== "Sonstiges") });
});

/** KI-Vorschlag aus Einrichtung, Profil und Formularen (wird nicht gespeichert). */
export const POST = withSession(
  async (_req, { store }) => {
    const company = await store.getCompany();
    const p = company.businessProfile;
    const services = company.services.filter((s) => s !== "Sonstiges");
    const known = await knownFields(store);
    const documents = [...new Set(services.flatMap((s) => profileDocumentsFor(p, s)))];
    const suggestion = await suggestWhatsAppQuestions({ industry: p.industry, description: p.description, services, needsAddress: p.needsAddress ?? true, known, documents });
    if (!suggestion) return apiError("Der Vorschlag konnte gerade nicht erstellt werden. Bitte gleich noch einmal versuchen.", 503);
    return json({ questions: suggestion });
  },
  { permission: "assistant:manage" },
);

const schema = z.object({
  questions: z
    .array(z.object({ key: z.string().max(60).default(""), label: z.string().max(80).default(""), prompt: z.string().max(240).default(""), services: z.array(z.string().max(80)).max(30).default([]) }))
    .max(20),
});

/** Liste speichern. Leere Liste = keine eigene Liste mehr (normaler Ablauf). */
export const PUT = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    const company = await store.getCompany();
    const known = (await store.listQuestions()).filter((q) => !q.whatsappOnly).map((q) => q.key);
    const formKeys = Object.values(company.businessProfile.templateQuestions ?? {}).flatMap((l) => l.map((q) => q.key));
    const list = normalizeWhatsAppQuestions(body.data.questions, company.services, [...known, ...formKeys, ...(company.businessProfile.whatsappQuestions ?? []).map((q) => q.key)]);
    await store.updateCompany({ businessProfile: { ...company.businessProfile, whatsappQuestions: list.length ? list : undefined } });
    return json({ questions: list.length ? list : null });
  },
  { permission: "assistant:manage" },
);
