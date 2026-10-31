import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { pushConfigured, pushSubscriptionsOf, sendPush } from "@/lib/push";

/** Ist Push eingerichtet, und ist dieses Gerät (endpoint) angemeldet? */
export const GET = withSession(async (req, { store }) => {
  const endpoint = req.nextUrl.searchParams.get("endpoint") ?? "";
  const subs = pushSubscriptionsOf((await store.getCompany()).businessProfile);
  return json({ available: pushConfigured(), publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "", subscribed: Boolean(endpoint) && subs.some((s) => s.endpoint === endpoint), devices: subs.length });
});

const subSchema = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

/** Dieses Gerät anmelden und eine Testbenachrichtigung schicken. */
export const POST = withSession(
  async (req, { store, session }) => {
    if (!pushConfigured()) return apiError("Benachrichtigungen sind noch nicht eingerichtet.", 503);
    const body = await parseBody(req, subSchema);
    if (!body.ok) return body.res;
    const company = await store.getCompany();
    const others = pushSubscriptionsOf(company.businessProfile).filter((s) => s.endpoint !== body.data.endpoint);
    await store.updateCompany({ businessProfile: { ...company.businessProfile, push: [...others, { ...body.data, userId: session.userId, createdAt: new Date().toISOString() }].slice(-20) } });
    await sendPush(store, { title: "FallFlow", body: "Benachrichtigungen sind auf diesem Gerät eingeschaltet.", url: "/dashboard" });
    return json({ ok: true });
  },
  { limit: 10 },
);

/** Dieses Gerät abmelden. */
export const DELETE = withSession(async (req, { store }) => {
  const endpoint = req.nextUrl.searchParams.get("endpoint") ?? "";
  const company = await store.getCompany();
  await store.updateCompany({ businessProfile: { ...company.businessProfile, push: pushSubscriptionsOf(company.businessProfile).filter((s) => s.endpoint !== endpoint) } });
  return json({ ok: true });
});
