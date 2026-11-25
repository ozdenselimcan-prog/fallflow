import { z } from "zod";
import { json, parseBody, withSession } from "@/lib/api";
import type { BusinessProfile } from "@/lib/data/types";

/**
 * Einrichtungs-Gespräch (components/onboarding/interview.tsx): speichert eine einzelne Antwort sofort. Leistungen, Angaben,
 * Unterlagen und "Hier antworte ich selbst" laufen über PUT /api/business-profile – hier nur, was zusätzlich dazukommt.
 */
const list = z.array(z.string().trim().min(1).max(80)).max(12);
const schema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("customers"), values: list }),
  z.object({ step: z.literal("area"), value: z.string().trim().max(200) }),
  z.object({ step: z.literal("strengths"), values: list }),
  z.object({ step: z.literal("faqs"), faqs: z.array(z.object({ q: z.string().trim().min(3).max(200), a: z.string().trim().max(600) })).max(8) }),
  z.object({
    step: z.literal("tone"),
    tone: z.enum(["professional", "friendly", "short"]),
    greeting: z.enum(["guten-tag", "hallo", "sehr-geehrte"]),
    signature: z.string().trim().max(120),
  }),
]);

const AREA_QUESTION = "In welchem Gebiet sind Sie tätig?";
const GREETINGS = { "guten-tag": "", hallo: "Hallo {name},", "sehr-geehrte": "Sehr geehrte/r {name}," } as const;

export const POST = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    const d = body.data;
    const company = await store.getCompany();
    const profile: BusinessProfile = { ...company.businessProfile };
    const interview = { ...(profile.interview ?? {}) };
    let knowledge = profile.knowledge ?? { prices: [], faqs: [] };
    const setFaq = (q: string, a: string) => {
      const faqs = knowledge.faqs.filter((f) => f.q !== q);
      knowledge = { ...knowledge, faqs: a ? [...faqs, { q, a }] : faqs };
    };

    if (d.step === "customers") interview.customers = d.values;
    if (d.step === "strengths") interview.strengths = d.values;
    if (d.step === "area") {
      interview.area = d.value;
      // Auch als häufige Frage, damit Website-Chat und KI-Antworten das Gebiet nennen können.
      setFaq(AREA_QUESTION, !d.value ? "" : /^wir\b/i.test(d.value) ? d.value : `Unser Einsatzgebiet: ${d.value.replace(/[.!]+$/, "")}.`);
    }
    if (d.step === "faqs") for (const f of d.faqs) setFaq(f.q, f.a);
    if (d.step === "tone") {
      const assistant = await store.getAssistant();
      await store.saveAssistant({ ...assistant, tone: d.tone });
      const texts = { ...(profile.texts ?? {}) };
      const greeting = GREETINGS[d.greeting];
      if (greeting) texts["email.greeting"] = greeting;
      else delete texts["email.greeting"];
      // Unterschrift: "Viele Grüße" + Name; leer = Standard (Viele Grüße + Firmenname).
      if (d.signature) texts["email.signoff"] = `${d.tone === "professional" ? "Mit freundlichen Grüßen" : "Viele Grüße"}\n${d.signature}`;
      else delete texts["email.signoff"];
      profile.texts = texts;
    }

    await store.updateCompany({ businessProfile: { ...profile, interview, knowledge } });
    return json({ ok: true });
  },
  { permission: "company:manage" },
);
