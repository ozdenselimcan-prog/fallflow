import { json, withSession } from "@/lib/api";
import { syncLatestSubscription } from "@/lib/billing/stripe-sync";

/** "Bereits bezahlt?" – holt den aktuellen Abo-Stand dieses Büros direkt von Stripe. */
export const POST = withSession(
  async (_req, { session }) => {
    try {
      return json({ found: await syncLatestSubscription(session.companyId) });
    } catch (err) {
      console.error("[billing/sync]", err instanceof Error ? err.message : "Fehler");
      return json({ found: false });
    }
  },
  { limit: 10 },
);
