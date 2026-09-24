import { apiError, json, parseBody, withSession } from "@/lib/api";
import { STATUS_LABELS } from "@/lib/cases/fields";
import { saveCaseFields } from "@/lib/cases/service";
import { publicDocument } from "@/lib/documents/public";
import { casePatchSchema, caseIdSchema as idSchema } from "@/lib/validation";

export const GET = withSession(async (_req, { store }, ctx: RouteContext<"/api/cases/[id]">) => {
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) return apiError("Nicht gefunden", 404);
  const c = await store.getCase(id);
  if (!c) return apiError("Nicht gefunden", 404);
  const [events, messages, documents, followUps] = await Promise.all([store.listEvents(id), store.listMessages(id), store.listDocuments(id), store.listFollowUps(id)]);
  return json({ case: c, events, messages, documents: documents.map(publicDocument), followUps });
});

export const PATCH = withSession(
  async (req, { store, session }, ctx: RouteContext<"/api/cases/[id]">) => {
    const { id } = await ctx.params;
    if (!idSchema.safeParse(id).success) return apiError("Nicht gefunden", 404);
    const body = await parseBody(req, casePatchSchema);
    if (!body.ok) return body.res;
    const { status, fields, assign } = body.data;

    let c = await store.getCase(id);
    if (!c) return apiError("Nicht gefunden", 404);

    if (fields && Object.keys(fields).length) c = await saveCaseFields(store, c, fields);

    // „Fall übernehmen“ = Fall wird dem Benutzer zugewiesen und gilt als übernommen (CONVERTED).
    const nextStatus = assign ? "CONVERTED" : status;
    if (nextStatus || assign) {
      c = (await store.updateCase(id, { status: nextStatus, assignedTo: assign ? session.userId : undefined })) ?? c;
      if (nextStatus) await store.addEvent(id, "status", assign ? "Fall vom Berater übernommen" : `Status manuell gesetzt: ${STATUS_LABELS[nextStatus]}`);
    }
    return json({ case: c });
  },
  { permission: "cases:write" },
);

export const DELETE = withSession(
  async (_req, { store }, ctx: RouteContext<"/api/cases/[id]">) => {
    const { id } = await ctx.params;
    if (!idSchema.safeParse(id).success) return apiError("Nicht gefunden", 404);
    await store.deleteCase(id);
    return json({ ok: true });
  },
  { permission: "cases:write" },
);
