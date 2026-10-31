import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { translateToGerman } from "@/lib/ai/language";
import { caseIdSchema } from "@/lib/validation";

/** Eine Nachricht des Falls fürs Büro ins Deutsche übersetzen (wird nicht gespeichert). */
export const POST = withSession(
  async (req, { store }, ctx: RouteContext<"/api/cases/[id]/translate">) => {
    const { id } = await ctx.params;
    if (!caseIdSchema.safeParse(id).success) return apiError("Nicht gefunden", 404);
    const body = await parseBody(req, z.object({ messageId: z.string().min(1).max(64) }));
    if (!body.ok) return body.res;
    const message = (await store.listMessages(id)).find((m) => m.id === body.data.messageId);
    if (!message) return apiError("Nachricht nicht gefunden", 404);
    const text = await translateToGerman(message.content);
    if (!text) return apiError("Die Übersetzung hat gerade nicht geklappt. Bitte gleich noch einmal versuchen.", 503);
    return json({ text });
  },
  { limit: 60 },
);
