import { apiError, json, withSession } from "@/lib/api";
import { setCancelAtPeriodEnd, stripeConfigured } from "@/lib/integrations/stripe";
import { createAdminClient } from "@/lib/supabase/clients";

/** Nimmt eine zuvor ausgesprochene Kündigung zurück – das Abo läuft normal weiter. */
export const POST = withSession(
  async (_req, { store, session }) => {
    if (!stripeConfigured()) return apiError("Stripe ist noch nicht konfiguriert", 400);
    const subscription = await store.getSubscription();
    if (!subscription.stripeCustomerId) return apiError("Noch kein Stripe-Kunde für dieses Büro vorhanden", 400);
    try {
      await setCancelAtPeriodEnd(subscription.stripeCustomerId, false);
    } catch (err) {
      console.error("[billing/resume]", err instanceof Error ? err.message : "Fehler");
      return apiError(err instanceof Error ? err.message : "Zurücknehmen fehlgeschlagen", 500);
    }
    const admin = createAdminClient();
    await admin?.from("subscriptions").update({ cancel_at_period_end: false }).eq("company_id", session.companyId);
    return json({ ok: true });
  },
  { permission: "billing:manage" },
);
