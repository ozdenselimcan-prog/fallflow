import { apiError, json, withSession } from "@/lib/api";
import { AI_TOOLS_LOCKED_TEXT, planHasAiTools } from "@/lib/billing/usage";
import { estimateUValues } from "@/lib/building/u-values";
import { caseIdSchema } from "@/lib/validation";

/** Schlägt grobe U-Werte (Außenwand/Fenster/Dach) für die Baualtersklasse dieses Falls vor – nur eine
 * Orientierung, kein Messwert. Übernimmt nichts automatisch; die Werte werden erst in die Fallakte
 * geschrieben, wenn das Büro sie einzeln bestätigt (normales PATCH /api/cases/[id]). */
export const POST = withSession(
  async (_req, { store }, ctx: RouteContext<"/api/cases/[id]/u-values">) => {
    if (!(await planHasAiTools(store))) return apiError(AI_TOOLS_LOCKED_TEXT, 403);
    const { id } = await ctx.params;
    if (!caseIdSchema.safeParse(id).success) return apiError("Nicht gefunden", 404);
    const c = await store.getCase(id);
    if (!c) return apiError("Nicht gefunden", 404);
    const suggestion = estimateUValues(c.fields.yearBuilt);
    if (!suggestion) return apiError("Kein plausibles Baujahr im Fall hinterlegt – keine Schätzung möglich.", 400);
    return json({ suggestion });
  },
  { permission: "cases:write" },
);
