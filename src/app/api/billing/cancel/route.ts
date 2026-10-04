import { apiError, json, withSession } from "@/lib/api";
import { setCancelAtPeriodEnd, stripeConfigured } from "@/lib/integrations/stripe";
import { createAdminClient } from "@/lib/supabase/clients";

/** Kündigt das Abo zum Ende der aktuellen Periode (kein sofortiger Entzug der Funktionen). */
export const POST = withSession(
  async (_req, { store, session }) => {
    if (!stripeConfigured()) return apiError("Stripe ist noch nicht konfiguriert", 400);
    const subscription = await store.getSubscription();
    if (!subscription.stripeCustomerId) return apiError("Noch kein Stripe-Kunde für dieses Büro vorhanden", 400);
    try {
      await setCancelAtPeriodEnd(subscription.stripeCustomerId, true);
    } catch (err) {
      console.error("[billing/cancel]", err instanceof Error ? err.message : "Fehler");
      return apiError(err instanceof Error ? err.message : "Kündigung fehlgeschlagen", 500);
    }
    const admin = createAdminClient();
    await admin?.from("subscriptions").update({ cancel_at_period_end: true }).eq("company_id", session.companyId);
    return json({ ok: true });
  },
  { permission: "billing:manage" },
);
