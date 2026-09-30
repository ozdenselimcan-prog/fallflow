import Stripe from "stripe";
import { siteConfig } from "@/lib/config/site";
import type { Plan } from "@/lib/config/pricing";

const PLAN_PRICE_ENV: Record<Plan["id"], string> = {
  starter: "STRIPE_PRICE_STARTER",
  pro: "STRIPE_PRICE_PRO",
  business: "STRIPE_PRICE_BUSINESS",
};

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

let client: Stripe | null = null;
export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!client) client = new Stripe(key);
  return client;
}

export function priceIdForPlan(planId: Plan["id"]): string | null {
  return process.env[PLAN_PRICE_ENV[planId]] ?? null;
}

export function planForPriceId(priceId: string): Plan["id"] | null {
  const entry = (Object.entries(PLAN_PRICE_ENV) as [Plan["id"], string][]).find(([, envKey]) => process.env[envKey] === priceId);
  return entry?.[0] ?? null;
}

interface CheckoutParams {
  companyId: string;
  planId: Plan["id"];
  customerEmail: string;
  existingCustomerId: string | null;
}

/** Erzeugt eine Stripe-Checkout-Session für ein Upgrade. Wirft, wenn Stripe/Preis nicht konfiguriert ist. */
export async function createCheckoutSession({ companyId, planId, customerEmail, existingCustomerId }: CheckoutParams) {
  const stripe = getStripeClient();
  if (!stripe) throw new Error("Stripe ist nicht konfiguriert");
  const price = priceIdForPlan(planId);
  if (!price) throw new Error(`Kein Stripe-Preis für Plan "${planId}" hinterlegt`);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: `${siteConfig.appUrl}/dashboard/settings/billing?checkout=success`,
    cancel_url: `${siteConfig.appUrl}/dashboard/settings/billing?checkout=cancelled`,
    ...(existingCustomerId ? { customer: existingCustomerId } : { customer_email: customerEmail }),
    client_reference_id: companyId,
    subscription_data: { metadata: { companyId, plan: planId } },
    metadata: { companyId, plan: planId },
  });
  if (!session.url) throw new Error("Stripe hat keine Checkout-URL zurückgegeben");
  return session.url;
}

/** Erzeugt eine Stripe-Kundenportal-Session (Zahlungsmethode verwalten, kündigen, Rechnungen einsehen). */
export async function createPortalSession(customerId: string) {
  const stripe = getStripeClient();
  if (!stripe) throw new Error("Stripe ist nicht konfiguriert");
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteConfig.appUrl}/dashboard/settings/billing`,
  });
  return session.url;
}

export function verifyStripeWebhook(raw: string, signature: string | null): Stripe.Event {
  const stripe = getStripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret || !signature) throw new Error("Stripe-Webhook ist nicht konfiguriert");
  return stripe.webhooks.constructEvent(raw, signature, secret);
}
