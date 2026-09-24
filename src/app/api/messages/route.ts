import { z } from "zod";
import { apiError, json, parseBody, parseQuery, withSession } from "@/lib/api";
import { messageSchema } from "@/lib/validation";

export const GET = withSession(async (req, { store }) => {
  const q = parseQuery(req, z.object({ caseId: z.string().uuid().or(z.string().regex(/^c-\d+$/)) }));
  if (!q.success) return apiError("caseId fehlt", 400);
  return json({ messages: await store.listMessages(q.data.caseId) });
});

/** Team-Nachricht zum Fall. Der Versand über E-Mail/WhatsApp wird über die Kanal-Adapter angebunden. */
export const POST = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, messageSchema);
    if (!body.ok) return body.res;
    if (!(await store.getCase(body.data.caseId))) return apiError("Fall nicht gefunden", 404);
    const message = await store.addMessage(body.data.caseId, "assistant", body.data.content);
    await store.addEvent(body.data.caseId, "note", "Nachricht vom Team gespeichert");
    return json({ message }, 201);
  },
  { permission: "cases:write" },
);
