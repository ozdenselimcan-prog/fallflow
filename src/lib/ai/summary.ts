import { buildSummary } from "@/lib/cases/completeness";
import { buildSummaryUserPrompt, SUMMARY_SYSTEM_PROMPT } from "./prompts";
import { getAiProvider } from "./provider";
import { z } from "zod";

const summarySchema = z.object({ summary: z.string().min(20).max(700) });

/**
 * Kurzfassung der Fallakte. Mit KI-Key formuliert das Modell (Ausgabe strikt validiert),
 * sonst – und bei jedem Fehler – greift die deterministische Zusammenfassung aus den erfassten Angaben.
 */
export async function summarizeCase(fields: Record<string, string>): Promise<{ text: string; source: "ai" | "rules" }> {
  const fallback = { text: buildSummary(fields), source: "rules" as const };
  const provider = getAiProvider();
  if (!provider) return fallback;
  try {
    const parsed = summarySchema.safeParse(await provider.completeJson(SUMMARY_SYSTEM_PROMPT, buildSummaryUserPrompt(fields)));
    if (!parsed.success) return fallback;
    return { text: parsed.data.summary.replace(/[<>]/g, "").trim(), source: "ai" };
  } catch (err) {
    console.error("[ai] Zusammenfassung fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
    return fallback;
  }
}
