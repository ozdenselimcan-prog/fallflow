import { z } from "zod";
import { apiError, json, publicRoute } from "@/lib/api";
import { findUploadContext } from "@/lib/data";
import { bookByCustomer } from "@/lib/intake/case-ops";

const schema = z.object({ startsAt: z.string().max(40) });

/** Öffentliche Terminbuchung des Kunden (geheimer Link-Token des Falls): gewählten freien Termin eintragen. */
export const POST = publicRoute("booking", 20, async (req, ctx: RouteContext<"/api/booking/[token]">) => {
  const { token } = await ctx.params;
  const found = await findUploadContext(token);
  if (!found) return apiError("Der Link ist ungültig oder abgelaufen.", 404);
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return apiError("Ungültiger Termin", 400);
  const r = await bookByCustomer(found.store, found.caseRecord, body.data.startsAt);
  if (!r.ok) return apiError(r.message, 409);
  return json({ ok: true, confirmed: r.confirmed });
});
