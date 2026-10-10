import { z } from "zod";
import { json, parseBody, withSession } from "@/lib/api";
import { SERVICES } from "@/lib/cases/fields";

const saveSchema = z.object({
  service: z.enum(SERVICES),
  body: z.string().max(2000),
  appointmentNote: z.string().max(500).optional(),
  requiresFloorplan: z.boolean().nullable().optional(),
  requiresEnergyCertificate: z.boolean().nullable().optional(),
});

export const GET = withSession(async (_req, { store }) => json({ serviceMessages: await store.listServiceMessages() }));

/** Büro schreibt/ändert den Nachrichtentext für eine Leistung (wird zusätzlich zu den Vorlagen-Links verschickt). */
export const PUT = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, saveSchema);
    if (!body.ok) return body.res;
    const saved = await store.saveServiceMessage(body.data);
    return json({ serviceMessage: saved });
  },
  { permission: "company:manage" },
);
