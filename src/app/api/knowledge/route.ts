import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { cleanKnowledge, suggestFaqQuestions } from "@/lib/ai/knowledge";

/** „Wissen & Preise“ laden (null = noch nie gespeichert – dann schlägt die Seite einmal typische Fragen vor). */
export const GET = withSession(async (_req, { store }) => {
  const company = await store.getCompany();
  return json({ knowledge: company.businessProfile.knowledge ?? null, services: company.services.filter((s) => s !== "Sonstiges") });
});

const schema = z.object({
  prices: z.array(z.object({ item: z.string().max(200).default(""), price: z.string().max(100).default(""), note: z.string().max(400).default("") })).max(100).default([]),
  faqs: z.array(z.object({ q: z.string().max(400).default(""), a: z.string().max(1200).default("") })).max(80).default([]),
});

/** Speichern – unvollständige Zeilen (ohne Preis bzw. ohne Antwort) werden weggelassen. */
export const PUT = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    const company = await store.getCompany();
    const knowledge = cleanKnowledge(body.data);
    await store.updateCompany({ businessProfile: { ...company.businessProfile, knowledge } });
    return json({ knowledge });
  },
  { permission: "assistant:manage" },
);

/** Typische Kundenfragen der Branche vorschlagen (ohne Antworten, nichts wird gespeichert). */
export const POST = withSession(
  async (_req, { store }) => {
    const company = await store.getCompany();
    const p = company.businessProfile;
    const questions = await suggestFaqQuestions({ industry: p.industry, description: p.description }, company.services.filter((s) => s !== "Sonstiges"));
    if (!questions.length) return apiError("Gerade konnten keine Vorschläge erstellt werden. Bitte gleich noch einmal versuchen.", 503);
    return json({ questions });
  },
  { permission: "assistant:manage" },
);
