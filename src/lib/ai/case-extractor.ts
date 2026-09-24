import { heuristicExtract } from "./heuristic";
import { buildExtractionUserPrompt, EXTRACTION_SYSTEM_PROMPT } from "./prompts";
import { getAiProvider } from "./provider";
import { extractionSchema, extractionToFields, type Extraction } from "./schema";

export interface ExtractionResult {
  fields: Record<string, string>;
  /** "ai" = validierte Modellantwort, "mock" = regelbasiert (kein Key oder Fallback) */
  source: "ai" | "mock";
  /** true, wenn die KI antworten sollte, das Ergebnis aber unbrauchbar war */
  degraded: boolean;
}

/**
 * Extrahiert Fallfelder aus Freitext. Modellausgaben werden nie blind übernommen:
 * ungültiges JSON → Fehler-Log (ohne Nutzertext) und Fallback auf den Regel-Extraktor.
 */
export async function extractFields(text: string): Promise<ExtractionResult> {
  const provider = getAiProvider();
  if (!provider) return { fields: heuristicExtract(text), source: "mock", degraded: false };

  try {
    const raw = await provider.completeJson(EXTRACTION_SYSTEM_PROMPT, buildExtractionUserPrompt(text));
    const parsed = extractionSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[ai] Ungültige Extraktionsantwort:", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      return { fields: heuristicExtract(text), source: "mock", degraded: true };
    }
    const fields = extractionToFields(parsed.data);
    fields.description ||= text.trim().slice(0, 1000);
    return { fields, source: "ai", degraded: false };
  } catch (err) {
    console.error("[ai] Extraktion fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
    return { fields: heuristicExtract(text), source: "mock", degraded: true };
  }
}

/** Kompletter Extraktionsdatensatz im spezifizierten JSON-Format (für /api/ai/extract-case). */
export function fieldsToExtraction(fields: Record<string, string>, requiredKeys: string[]): Extraction {
  const missing = requiredKeys.filter((k) => !fields[k]);
  return extractionSchema.parse({
    customer: { name: fields.name ?? "", email: fields.email ?? "", phone: fields.phone ?? "" },
    property: {
      type: fields.buildingType ?? "",
      yearBuilt: fields.yearBuilt ? Number(fields.yearBuilt) : null,
      livingArea: fields.livingArea ? Number(fields.livingArea) : null,
      postalCode: fields.postalCode ?? "",
    },
    heating: { type: fields.heating ?? "" },
    request: { service: fields.service ?? "", description: fields.description ?? "" },
    missingFields: missing,
    completionPercent: requiredKeys.length ? Math.round(((requiredKeys.length - missing.length) / requiredKeys.length) * 100) : 100,
  });
}
