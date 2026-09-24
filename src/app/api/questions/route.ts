import { z } from "zod";
import { apiError, json, parseBody, parseQuery, withSession } from "@/lib/api";
import { questionSchema, reorderSchema } from "@/lib/validation";

export const GET = withSession(async (_req, { store }) => json({ questions: await store.listQuestions() }));

export const POST = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, questionSchema);
    if (!body.ok) return body.res;
    const existing = await store.listQuestions();
    const clash = existing.find((q) => q.key === body.data.key && q.id !== body.data.id);
    if (clash) return apiError("Dieser Schlüssel wird bereits verwendet", 409);
    if (body.data.type === "choice" && body.data.options.length < 2) return apiError("Auswahlfragen brauchen mindestens zwei Optionen", 400);
    return json({ question: await store.saveQuestion(body.data) }, body.data.id ? 200 : 201);
  },
  { permission: "assistant:manage" },
);

export const PUT = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, reorderSchema);
    if (!body.ok) return body.res;
    await store.reorderQuestions(body.data.ids);
    return json({ ok: true });
  },
  { permission: "assistant:manage" },
);

export const DELETE = withSession(
  async (req, { store }) => {
    const q = parseQuery(req, z.object({ id: z.string().min(1) }));
    if (!q.success) return apiError("id fehlt", 400);
    await store.deleteQuestion(q.data.id);
    return json({ ok: true });
  },
  { permission: "assistant:manage" },
);
