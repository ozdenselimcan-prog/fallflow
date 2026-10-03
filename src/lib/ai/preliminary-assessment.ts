import type { AiImage } from "./provider";
import { getAiProvider } from "./provider";

const SYSTEM = `Du bist eine Vorbereitungshilfe für einen Energieberater, kein Ersatz für die fachliche Vor-Ort-Prüfung.
Du bekommst Gebäudedaten und ggf. Auszüge aus Energieausweis, Grundriss und Fotos. Erstelle eine KURZE, unverbindliche
fachliche Voreinschätzung zur Vorbereitung des Beratungsgesprächs: typische Schwachstellen für Baualter/Gebäudetyp,
mögliche sinnvolle Maßnahmen, und konkrete Punkte, die der Berater vor Ort prüfen sollte.

Wichtig:
- Das ist KEINE Energieberatung und ersetzt keine fachliche Prüfung vor Ort – das muss aus dem Text selbst hervorgehen.
- Liegen zu wenig Informationen vor, sag das offen statt zu raten oder Allgemeinplätze zu liefern.
- Nutze nur, was tatsächlich in den Angaben/Bildern erkennbar ist, keine Spekulation über nicht sichtbare Details.
- Antworte AUSSCHLIESSLICH mit JSON: {"assessment": "<Text auf Deutsch, max. 900 Zeichen, in kurzen Stichpunkten mit Zeilenumbrüchen>"}`;

export interface AssessmentContext {
  fields: Record<string, string>;
  energyCertificateText?: string;
  images: AiImage[];
}

/** Erstellt eine unverbindliche KI-Voreinschätzung für die Gesprächsvorbereitung des Beraters (nie für den Kunden
 * sichtbar). Liefert null ohne AI-Key, bei Fehlern oder wenn das Modell kein verwertbares Ergebnis liefert. */
export async function buildPreliminaryAssessment(ctx: AssessmentContext): Promise<string | null> {
  const provider = getAiProvider();
  if (!provider) return null;

  const relevantKeys = ["service", "buildingType", "yearBuilt", "livingArea", "heating", "ownerStatus", "floors"];
  const facts = relevantKeys
    .filter((k) => ctx.fields[k])
    .map((k) => `${k}: ${ctx.fields[k]}`)
    .join("\n");
  const userText = [
    "Gebäudedaten:",
    facts || "(keine strukturierten Angaben vorhanden)",
    ctx.energyCertificateText ? `\nEnergieausweis-Auszug (Text):\n${ctx.energyCertificateText.slice(0, 3000)}` : "",
    ctx.images.length ? `\n(${ctx.images.length} Bild(er) angehängt: Grundriss/Fotos)` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = ctx.images.length ? await provider.completeJsonWithImages(SYSTEM, userText, ctx.images) : await provider.completeJson(SYSTEM, userText);
    const parsed = raw as { assessment?: unknown };
    const text = typeof parsed.assessment === "string" ? parsed.assessment.trim() : "";
    return text || null;
  } catch (err) {
    console.error("[preliminary-assessment] AI-Aufruf fehlgeschlagen:", err instanceof Error ? err.message : err);
    return null;
  }
}
