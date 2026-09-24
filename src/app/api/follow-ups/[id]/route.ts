import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { markFollowUpSentManually } from "@/lib/intake/follow-ups";

const actionSchema = z.object({ action: z.enum(["cancel", "mark_sent"]) });

/** Follow-up abbrechen oder als „vom Team gesendet“ markieren. */
export const PATCH = withSession(
  async (req, { store }, ctx: RouteContext<"/api/follow-ups/[id]">) => {
    const { id } = await ctx.params;
    const body = await parseBody(req, actionSchema);
    if (!body.ok) return body.res;
    const f = (await store.listFollowUps()).find((x) => x.id === id);
    if (!f) return apiError("Nicht gefunden", 404);
    if (body.data.action === "cancel") {
      await store.saveFollowUp({ ...f, status: "cancelled", note: "Vom Team abgebrochen." });
      await store.addEvent(f.caseId, "followup", "Follow-up abgebrochen");
    } else {
      await markFollowUpSentManually(store, f);
    }
    return json({ ok: true });
  },
  { permission: "cases:write" },
);
