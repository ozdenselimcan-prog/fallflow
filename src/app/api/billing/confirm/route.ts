import { NextResponse } from "next/server";
import { withSession } from "@/lib/api";
import { applyCompletedCheckout } from "@/lib/billing/stripe-sync";
import { siteConfig } from "@/lib/config/site";
import { getStripeClient } from "@/lib/integrations/stripe";

/**
 * Rückkehr von der Stripe-Bezahlseite: Checkout direkt bei Stripe prüfen und das Abo sofort übernehmen – unabhängig
 * davon, ob bzw. wann der Webhook ankommt. Danach weiter ins Dashboard.
 */
export const GET = withSession(async (req, { session }) => {
  const sessionId = req.nextUrl.searchParams.get("session_id") ?? "";
  const stripe = getStripeClient();
  if (stripe && /^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    try {
      const checkout = await stripe.checkout.sessions.retrieve(sessionId);
      const companyId = checkout.client_reference_id ?? checkout.metadata?.companyId;
      // Nur das eigene Büro, nur abgeschlossene Checkouts.
      if (companyId === session.companyId && checkout.status === "complete") await applyCompletedCheckout(checkout);
    } catch (err) {
      console.error("[billing/confirm]", err instanceof Error ? err.message : "Fehler");
    }
  }
  const next = req.nextUrl.searchParams.get("next") === "billing" ? "/dashboard/settings/billing?checkout=success" : "/dashboard?checkout=success";
  return NextResponse.redirect(new URL(next, siteConfig.appUrl));
});
