import { apiError, json, withSession } from "@/lib/api";
import { writeServiceTexts } from "@/lib/ai/service-texts";

/**
 * Einrichtung "Ihre Texte": Die KI schreibt aus dem Einrichtungs-Gespräch für jede Leistung den Einstiegstext der automatischen
 * Antwort und speichert ihn als Nachrichtentext der Leistung (änderbar unter KI-Assistent → Vorlagen & Nachrichten).
 */
export const POST = withSession(
  async (_req, { store }) => {
    const [company, assistant, questions] = await Promise.all([store.getCompany(), store.getAssistant(), store.listQuestions()]);
    if (!company.services.length) return apiError("Bitte zuerst Ihre Leistungen festlegen.", 400);
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
    if (!texts) return apiError("Die Texte konnten gerade nicht erstellt werden. Bitte versuchen Sie es noch einmal.", 503);
    const existing = await store.listServiceMessages();
    for (const [service, body] of Object.entries(texts)) {
      const prev = existing.find((m) => m.service === service);
      await store.saveServiceMessage({ service, body, ...(prev ? { appointmentNote: prev.appointmentNote, subject: prev.subject } : {}) });
    }
    return json({ texts });
  },
  { permission: "company:manage", limit: 10 },
);
