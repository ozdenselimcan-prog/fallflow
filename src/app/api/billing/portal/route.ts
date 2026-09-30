import { apiError, json, withSession } from "@/lib/api";
import { createPortalSession, stripeConfigured } from "@/lib/integrations/stripe";

/** Öffnet das Stripe-Kundenportal (Zahlungsmethode verwalten, Rechnungen, kündigen). */
export const POST = withSession(
  async (_req, { store }) => {
    if (!stripeConfigured()) return apiError("Stripe ist noch nicht konfiguriert", 400);
    const subscription = await store.getSubscription();
    if (!subscription.stripeCustomerId) return apiError("Noch kein Stripe-Kunde für dieses Büro vorhanden", 400);
    try {
      const url = await createPortalSession(subscription.stripeCustomerId);
      return json({ url });
    } catch (err) {
      console.error("[billing/portal]", err instanceof Error ? err.message : "Fehler");
      return apiError(err instanceof Error ? err.message : "Portal konnte nicht geöffnet werden", 500);
    }
  },
  { permission: "billing:manage" },
);
