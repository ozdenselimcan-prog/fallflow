import { after } from "next/server";
import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { isPlatformAdmin } from "@/lib/admin/overview";
import { releaseManagedSetup, retryManagedSetup } from "@/lib/setup/managed";

export const maxDuration = 300;

/** Betreiber: über die Website angelegtes Konto freischalten (Zugang per Mail) bzw. die Einrichtung erneut starten. */
export const POST = withSession(async (req, { session }) => {
  if (!isPlatformAdmin(session.email)) return apiError("Nicht gefunden", 404);
  const body = await parseBody(req, z.object({ companyId: z.string().uuid(), action: z.enum(["release", "retry"]) }));
  if (!body.ok) return body.res;
  if (body.data.action === "retry") {
    after(() => retryManagedSetup(body.data.companyId));
    return json({ ok: true });
  }
  const result = await releaseManagedSetup(body.data.companyId);
  if (!result.ok) return apiError(result.error, 400);
  return json({ ok: true });
});
