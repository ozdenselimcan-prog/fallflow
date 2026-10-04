import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripeClient, planForPriceId, stripeConfigured, verifyStripeWebhook } from "@/lib/integrations/stripe";
import { createAdminClient } from "@/lib/supabase/clients";

const STATUS_MAP: Record<string, "trialing" | "active" | "past_due" | "canceled"> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "past_due",
  incomplete: "trialing",
  incomplete_expired: "canceled",
  paused: "canceled",
};

/**
 * Empfängt Stripe-Ereignisse (Checkout abgeschlossen, Abo geändert/gekündigt) und schreibt den
 * Abo-Stand ins jeweilige Büro. Schreibzugriff auf `subscriptions` ist per RLS ausschließlich der
 * Service Role vorbehalten – genau die nutzt dieser Webhook.
 */
export async function POST(req: NextRequest) {
  if (!stripeConfigured()) return NextResponse.json({ mock: true }, { status: 200 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = verifyStripeWebhook(raw, req.headers.get("stripe-signature"));
  } catch (err) {
    console.error("[stripe webhook] Signatur ungültig:", err instanceof Error ? err.message : "Fehler");
    return new NextResponse("Forbidden", { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const companyId = session.client_reference_id ?? session.metadata?.companyId;
        const plan = session.metadata?.plan;
        if (!companyId) break;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : (session.subscription?.id ?? null);

        // Echten Status (z. B. "trialing" bei einer Testphase) statt pauschal "active" übernehmen.
        let status: "trialing" | "active" | "past_due" | "canceled" = "active";
        let currentPeriodEnd: string | null = null;
        const stripe = getStripeClient();
        if (subscriptionId && stripe) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          status = STATUS_MAP[sub.status] ?? "active";
          const periodEndSeconds = sub.items.data[0]?.current_period_end;
          currentPeriodEnd = periodEndSeconds ? new Date(periodEndSeconds * 1000).toISOString() : null;
        }

        const { error } = await admin
          .from("subscriptions")
          .update({
            ...(plan ? { plan } : {}),
            status,
            current_period_end: currentPeriodEnd,
            stripe_customer_id: typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null),
            stripe_subscription_id: subscriptionId,
            cancel_at_period_end: false,
          })
          .eq("company_id", companyId);
        if (error) console.error("[stripe webhook] checkout.session.completed:", error.message);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const companyId = sub.metadata?.companyId;
        if (!companyId) break;
        const priceId = sub.items.data[0]?.price?.id;
        const plan = priceId ? planForPriceId(priceId) : null;
        const status = event.type === "customer.subscription.deleted" ? "canceled" : (STATUS_MAP[sub.status] ?? "active");
        const periodEndSeconds = sub.items.data[0]?.current_period_end;
        const { error } = await admin
          .from("subscriptions")
          .update({
            ...(plan ? { plan } : {}),
            status,
            current_period_end: periodEndSeconds ? new Date(periodEndSeconds * 1000).toISOString() : null,
            stripe_subscription_id: sub.id,
            cancel_at_period_end: event.type === "customer.subscription.deleted" ? false : sub.cancel_at_period_end,
          })
          .eq("company_id", companyId);
        if (error) console.error("[stripe webhook]", event.type, error.message);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe webhook]", event.type, err instanceof Error ? err.message : "Fehler");
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
