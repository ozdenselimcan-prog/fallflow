import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { applyCompletedCheckout, STATUS_MAP } from "@/lib/billing/stripe-sync";
import { planForPriceId, stripeConfigured, verifyStripeWebhook } from "@/lib/integrations/stripe";
import { createAdminClient } from "@/lib/supabase/clients";

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
        await applyCompletedCheckout(event.data.object as Stripe.Checkout.Session);
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
        // Vertragsende festhalten (Grundlage für die Löschung nach 30 Tagen, AVV § 9) – bzw. zurücksetzen, wenn das
        // Abo wieder läuft.
        if (status === "canceled") {
          await admin.from("subscriptions").update({ canceled_at: new Date().toISOString() }).eq("company_id", companyId).is("canceled_at", null);
        } else {
          await admin.from("subscriptions").update({ canceled_at: null, deletion_warning_sent_at: null }).eq("company_id", companyId);
        }
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
