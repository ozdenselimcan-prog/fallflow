import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { isPlatformAdmin } from "@/lib/admin/overview";
import { getPublicStore } from "@/lib/data";

/** Betreiber: WhatsApp-Freischaltung eines Büros bestätigen (nachdem es in der Meta-App als Tester eingetragen wurde). */
export const POST = withSession(async (req, { session }) => {
  if (!isPlatformAdmin(session.email)) return apiError("Nicht gefunden", 404);
  const body = await parseBody(req, z.object({ companyId: z.string().uuid() }));
  if (!body.ok) return body.res;
  const store = await getPublicStore(body.data.companyId);
  if (!store) return apiError("Büro nicht gefunden", 404);
  const company = await store.getCompany();
  if (!company.businessProfile.whatsappRequest) return apiError("Keine Anfrage vorhanden", 400);
  await store.updateCompany({ businessProfile: { ...company.businessProfile, whatsappRequest: { ...company.businessProfile.whatsappRequest, status: "approved" } } });
  return json({ ok: true });
});
