import { z } from "zod";
import { apiError, json, parseBody, parseQuery, withSession } from "@/lib/api";
import { addPhoneNote, sendTeamMessage } from "@/lib/intake/notes";
import { caseIdSchema, messageSchema } from "@/lib/validation";

export const GET = withSession(async (req, { store }) => {
  const q = parseQuery(req, z.object({ caseId: caseIdSchema }));
  if (!q.success) return apiError("caseId fehlt", 400);
  return json({ messages: await store.listMessages(q.data.caseId) });
});

/**
 * Telefonnotiz (intern, Angaben werden in die Fallakte übernommen) oder Nachricht an den Kunden.
 * Kundennachrichten gelten nur als gesendet, wenn der Kanal wirklich verbunden ist und versendet hat.
 */
export const POST = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, messageSchema);
    if (!body.ok) return body.res;
    const { caseId, content, kind } = body.data;
    if (!(await store.getCase(caseId))) return apiError("Fall nicht gefunden", 404);
    if (kind === "phone_note") {
      const { message, added } = await addPhoneNote(store, caseId, content);
      return json({ message, added }, 201);
    }
    const { message, delivered, reason } = await sendTeamMessage(store, caseId, { channel: kind, text: content });
    return json({ message, delivered, reason }, 201);
  },
  { permission: "cases:write" },
);
