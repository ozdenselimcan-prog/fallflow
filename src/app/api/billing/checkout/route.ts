import { apiError, json, parseBody, withSession } from "@/lib/api";
import { createCheckoutSession, stripeConfigured } from "@/lib/integrations/stripe";
import { checkoutSchema } from "@/lib/validation";

/** Startet ein Plan-Upgrade: erzeugt eine Stripe-Checkout-Session und liefert die URL zur Weiterleitung. */
export const POST = withSession(
  async (req, { session, store }) => {
    if (!stripeConfigured()) return apiError("Stripe ist noch nicht konfiguriert", 400);
    const body = await parseBody(req, checkoutSchema);
    if (!body.ok) return body.res;

    const subscription = await store.getSubscription();
    try {
      const url = await createCheckoutSession({
        companyId: session.companyId,
        planId: body.data.plan,
        customerEmail: session.email,
        existingCustomerId: subscription.stripeCustomerId,
      });
      return json({ url });
    } catch (err) {
      console.error("[billing/checkout]", err instanceof Error ? err.message : "Fehler");
      return apiError(err instanceof Error ? err.message : "Checkout fehlgeschlagen", 500);
    }
  },
  { permission: "billing:manage" },
);
