import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { SERVICES } from "@/lib/cases/fields";
import { deleteFile } from "@/lib/documents/storage";

const updateSchema = z.object({ service: z.enum([...SERVICES, ""]).optional(), title: z.string().trim().min(1).max(160).optional(), alwaysInclude: z.boolean().optional() });

/** Büro korrigiert/bestätigt die von der KI vorgeschlagene Leistung, den Titel, oder ob die Vorlage bei
 * jeder Anfrage (unabhängig von der Leistung) mitgeschickt werden soll. */
export const PUT = withSession(
  async (req, { store }, ctx: RouteContext<"/api/document-templates/[id]">) => {
    const { id } = await ctx.params;
    const body = await parseBody(req, updateSchema);
    if (!body.ok) return body.res;
    const existing = (await store.listDocumentTemplates()).find((t) => t.id === id);
    if (!existing) return apiError("Nicht gefunden", 404);
    const template = await store.saveDocumentTemplate({
      id,
      service: body.data.service ?? existing.service,
      title: body.data.title ?? existing.title,
      fileName: existing.fileName,
      storagePath: existing.storagePath,
      alwaysInclude: body.data.alwaysInclude,
    });
    return json({ template });
  },
  { permission: "company:manage" },
);

export const DELETE = withSession(
  async (_req, { store }, ctx: RouteContext<"/api/document-templates/[id]">) => {
    const { id } = await ctx.params;
    const existing = (await store.listDocumentTemplates()).find((t) => t.id === id);
    if (!existing) return apiError("Nicht gefunden", 404);
    await deleteFile(existing.storagePath);
    await store.deleteDocumentTemplate(id);
    return json({ ok: true });
  },
  { permission: "company:manage" },
);
