import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { assessCasePhotos, casePhotos, readPhotoNote, savePhotoNote } from "@/lib/intake/quote-ops";
import { caseIdSchema } from "@/lib/validation";

/** Foto-Einschätzung des Falls (nur intern): GET laden, POST von der KI erstellen lassen, PUT selbst bearbeiten. */
export const GET = withSession(async (_req, { store }, ctx: RouteContext<"/api/cases/[id]/photo-assessment">) => {
  const { id } = await ctx.params;
  if (!caseIdSchema.safeParse(id).success) return apiError("Nicht gefunden", 404);
  const c = await store.getCase(id);
  if (!c) return apiError("Nicht gefunden", 404);
  const note = readPhotoNote(c.fields);
  const photos = await casePhotos(store, id);
  return json({ note, photos: photos.length, unassessed: photos.filter((p) => !note?.docIds.includes(p.id)).length });
});

export const POST = withSession(
  async (_req, { store }, ctx: RouteContext<"/api/cases/[id]/photo-assessment">) => {
    const { id } = await ctx.params;
    if (!caseIdSchema.safeParse(id).success) return apiError("Nicht gefunden", 404);
    const c = await store.getCase(id);
    if (!c) return apiError("Nicht gefunden", 404);
    if (!(await casePhotos(store, id)).length) return apiError("In diesem Fall gibt es noch keine Fotos.", 400);
    const note = await assessCasePhotos(store, c);
    if (!note) return apiError("Die Fotos konnten gerade nicht ausgewertet werden. Bitte gleich noch einmal versuchen.", 503);
    return json({ note });
  },
  { permission: "cases:write", limit: 20 },
);

export const PUT = withSession(
  async (req, { store }, ctx: RouteContext<"/api/cases/[id]/photo-assessment">) => {
    const { id } = await ctx.params;
    if (!caseIdSchema.safeParse(id).success) return apiError("Nicht gefunden", 404);
    const c = await store.getCase(id);
    if (!c) return apiError("Nicht gefunden", 404);
    const body = await parseBody(req, z.object({ text: z.string().trim().max(2000) }));
    if (!body.ok) return body.res;
    const prev = readPhotoNote(c.fields);
    return json({ note: await savePhotoNote(store, c, { text: body.data.text, docIds: prev?.docIds ?? [], at: prev?.at ?? new Date().toISOString() }) });
  },
  { permission: "cases:write" },
);
