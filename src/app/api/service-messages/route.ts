import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";

const saveSchema = z.object({
  service: z.string().trim().min(1).max(80),
  body: z.string().max(2000),
  appointmentNote: z.string().max(500).optional(),
  requiresFloorplan: z.boolean().nullable().optional(),
  requiresEnergyCertificate: z.boolean().nullable().optional(),
  subject: z.string().trim().max(200).optional(),
  /** Betriebe mit Betriebsprofil: welche Unterlagen aus dem Profil der Kunde bei dieser Leistung schicken soll. */
  profileDocuments: z.array(z.string().trim().max(80)).max(10).optional(),
});

export const GET = withSession(async (_req, { store }) => json({ serviceMessages: await store.listServiceMessages() }));

/** Büro schreibt/ändert den Nachrichtentext für eine Leistung (wird zusätzlich zu den Vorlagen-Links verschickt). */
export const PUT = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, saveSchema);
    if (!body.ok) return body.res;
    const { profileDocuments, ...message } = body.data;
    const company = await store.getCompany();
    if (!company.services.includes(message.service)) return apiError("Diese Leistung bietet Ihr Betrieb nicht an.", 400);
    const saved = await store.saveServiceMessage(message);
    if (profileDocuments && company.businessProfile.industry) {
      const profile = company.businessProfile;
      await store.updateCompany({
        businessProfile: {
          ...profile,
          documentsByService: { ...profile.documentsByService, [message.service]: profile.documents.filter((d) => profileDocuments.includes(d)) },
        },
      });
    }
    return json({ serviceMessage: saved });
  },
  { permission: "company:manage" },
);
