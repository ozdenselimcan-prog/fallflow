import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { isPlatformAdmin } from "@/lib/admin/overview";
import { SUPPORT_COOKIE, SUPPORT_SESSION_HOURS, supportAccessActive, supportToken } from "@/lib/auth/support";
import { getPublicStore } from "@/lib/data";

/** Betreiber: Konto eines Betriebs im Support-Modus öffnen (nur wenn der Betrieb es erlaubt hat) bzw. wieder verlassen. */
export const POST = withSession(async (req, { session }) => {
  if (!isPlatformAdmin(session.email)) return apiError("Nicht gefunden", 404);
  const body = await parseBody(req, z.object({ companyId: z.string().uuid() }));
  if (!body.ok) return body.res;
  const store = await getPublicStore(body.data.companyId);
  if (!store) return apiError("Büro nicht gefunden", 404);
  const company = await store.getCompany();
  const access = company.businessProfile.supportAccess;
  if (!access || !supportAccessActive(access)) return apiError("Dieser Betrieb hat den Support-Zugang nicht (mehr) erlaubt.", 403);
  await store.updateCompany({ businessProfile: { ...company.businessProfile, supportAccess: { ...access, lastUsedAt: new Date().toISOString() } } });
  const res = json({ ok: true });
  res.cookies.set(SUPPORT_COOKIE, supportToken(body.data.companyId), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SUPPORT_SESSION_HOURS * 3600 });
  return res;
});

export const DELETE = withSession(async () => {
  const res = json({ ok: true });
  res.cookies.delete(SUPPORT_COOKIE);
  return res;
});
