import { apiError, json, withSession } from "@/lib/api";
import { AI_TOOLS_LOCKED_TEXT, planHasAiTools } from "@/lib/billing/usage";
import { estimateFoerderung, foerderDraftText } from "@/lib/foerder/estimate";
import { caseIdSchema } from "@/lib/validation";

/** Berechnet eine grobe, unverbindliche Förderschätzung als Entwurf – wird NICHT automatisch an den
 * Kunden geschickt. Das Büro prüft/bearbeitet den Text im Dashboard und verschickt ihn erst nach
 * ausdrücklicher Bestätigung (über die normale Nachrichtenfunktion, POST /api/messages). */
export const POST = withSession(
  async (_req, { store }, ctx: RouteContext<"/api/cases/[id]/foerder-estimate">) => {
    if (!(await planHasAiTools(store))) return apiError(AI_TOOLS_LOCKED_TEXT, 403);
    const { id } = await ctx.params;
    if (!caseIdSchema.safeParse(id).success) return apiError("Nicht gefunden", 404);
    const c = await store.getCase(id);
    if (!c) return apiError("Nicht gefunden", 404);
    const estimate = estimateFoerderung(c.fields);
    if (!estimate) return apiError("Für diesen Fall ist keine automatische Förderschätzung möglich (Leistung oder Angaben passen nicht).", 400);
    const draft = foerderDraftText(c.fields.name ?? "", estimate);
    return json({ draft, estimate });
  },
  { permission: "cases:write" },
);
