import { apiError, json, withSession } from "@/lib/api";
import { generateServiceTexts } from "@/lib/intake/interview-answers";

/**
 * Einrichtung "Ihre Texte": Die KI schreibt aus dem Einrichtungs-Gespräch für jede Leistung den Einstiegstext der automatischen
 * Antwort und speichert ihn als Nachrichtentext der Leistung (änderbar unter KI-Assistent → Vorlagen & Nachrichten).
 */
export const POST = withSession(
  async (_req, { store }) => {
    if (!(await store.getCompany()).services.length) return apiError("Bitte zuerst Ihre Leistungen festlegen.", 400);
    const texts = await generateServiceTexts(store);
    if (!texts) return apiError("Die Texte konnten gerade nicht erstellt werden. Bitte versuchen Sie es noch einmal.", 503);
    return json({ texts });
  },
  { permission: "company:manage", limit: 10 },
);
