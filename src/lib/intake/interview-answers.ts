import { z } from "zod";
import { cleanKnowledge } from "@/lib/ai/knowledge";
import { writeServiceTexts } from "@/lib/ai/service-texts";
import type { Store } from "@/lib/data/store";
import type { BusinessProfile } from "@/lib/data/types";

/**
 * Antworten aus dem Einrichtungs-Gespräch speichern (Einrichtung im Konto, siehe components/onboarding/interview.tsx, und
 * Einrichtung über die Website, siehe lib/setup/managed.ts). Leistungen, Angaben und Unterlagen laufen über saveBusinessProfile.
 */
const list = z.array(z.string().trim().min(1).max(80)).max(12);
export const interviewAnswerSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("customers"), values: list }),
  z.object({ step: z.literal("area"), value: z.string().trim().max(200) }),
  z.object({ step: z.literal("strengths"), values: list }),
  z.object({ step: z.literal("faqs"), faqs: z.array(z.object({ q: z.string().trim().min(3).max(200), a: z.string().trim().max(600) })).max(8) }),
  z.object({ step: z.literal("prices"), prices: z.array(z.object({ item: z.string().trim().max(80), price: z.string().trim().max(40), note: z.string().trim().max(160).default("") })).max(30) }),
  z.object({
    step: z.literal("tone"),
    tone: z.enum(["professional", "friendly", "short"]),
    greeting: z.enum(["guten-tag", "hallo", "sehr-geehrte"]),
    signature: z.string().trim().max(120),
  }),
]);
export type InterviewAnswer = z.infer<typeof interviewAnswerSchema>;

const AREA_QUESTION = "In welchem Gebiet sind Sie tätig?";
const GREETINGS = { "guten-tag": "", hallo: "Hallo {name},", "sehr-geehrte": "Sehr geehrte/r {name}," } as const;

export async function applyInterviewAnswer(store: Store, d: InterviewAnswer): Promise<void> {
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
  // Preisliste ersetzen (wie unter „Wissen & Preise“); Zeilen ohne Preis fallen weg.
  if (d.step === "prices") knowledge = { ...knowledge, prices: cleanKnowledge({ prices: d.prices }).prices };
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
}

/**
 * Die KI schreibt aus dem Einrichtungs-Gespräch für jede Leistung den Einstiegstext der automatischen Antwort und speichert
 * ihn als Nachrichtentext der Leistung. null = gerade nicht möglich (KI nicht erreichbar).
 */
export async function generateServiceTexts(store: Store): Promise<Record<string, string> | null> {
  const [company, assistant, questions] = await Promise.all([store.getCompany(), store.getAssistant(), store.listQuestions()]);
  if (!company.services.length) return null;
  const profile = company.businessProfile;
  const fieldServices = profile.fieldServices ?? {};
  const fieldsByService: Record<string, string[]> = {};
  for (const service of company.services) {
    fieldsByService[service] = questions
      .filter((q) => q.active && !["name", "email", "phone", "service", "postalCode", "street", "description"].includes(q.key))
      .filter((q) => !fieldServices[q.key]?.length || fieldServices[q.key].includes(service))
      .map((q) => q.label);
  }
  const texts = await writeServiceTexts({ companyName: company.name, tone: assistant.tone, profile, services: company.services, fieldsByService });
  if (!texts) return null;
  const existing = await store.listServiceMessages();
  for (const [service, body] of Object.entries(texts)) {
    const prev = existing.find((m) => m.service === service);
    await store.saveServiceMessage({ service, body, ...(prev ? { appointmentNote: prev.appointmentNote, subject: prev.subject } : {}) });
  }
  return texts;
}
