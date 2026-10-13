import type Stripe from "stripe";
import { getStripeClient, planForPriceId } from "@/lib/integrations/stripe";
import { createAdminClient } from "@/lib/supabase/clients";
import { rewardReferralIfDue } from "./referrals";

export const STATUS_MAP: Record<string, "trialing" | "active" | "past_due" | "canceled"> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "past_due",
  incomplete: "trialing",
  incomplete_expired: "canceled",
  paused: "canceled",
};

/** Überträgt den Stand eines Stripe-Abos in das Büro (subscriptions-Zeile). */
export async function syncSubscription(companyId: string, sub: Stripe.Subscription, planHint?: string | null): Promise<void> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Service-Role-Key fehlt");
  const priceId = sub.items.data[0]?.price?.id;
  const plan = (priceId ? planForPriceId(priceId) : null) ?? planHint ?? sub.metadata?.plan ?? null;
  const status = STATUS_MAP[sub.status] ?? "active";
  const periodEndSeconds = sub.items.data[0]?.current_period_end;
  const { error } = await admin
    .from("subscriptions")
    .update({
      ...(plan ? { plan } : {}),
      status,
      current_period_end: periodEndSeconds ? new Date(periodEndSeconds * 1000).toISOString() : null,
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      cancel_at_period_end: sub.cancel_at_period_end,
      ...(status === "canceled" ? {} : { canceled_at: null, deletion_warning_sent_at: null }),
    })
    .eq("company_id", companyId);
  if (error) throw new Error(`Abo konnte nicht gespeichert werden: ${error.message}`);
  if (status === "canceled") await admin.from("subscriptions").update({ canceled_at: new Date().toISOString() }).eq("company_id", companyId).is("canceled_at", null);
  // Zahlender Kunde geworden: ggf. Empfehlungsbonus für das Büro, das ihn geworben hat (Fehler blockieren den Abgleich nicht).
  if (status === "active") {
    await rewardReferralIfDue(companyId).catch((err) => console.error("[referral] Gutschrift fehlgeschlagen:", err instanceof Error ? err.message : "Fehler"));
  }
}

/** Abgeschlossener Checkout (Webhook oder Rückkehr von Stripe): zugehöriges Abo laden und übernehmen. */
export async function applyCompletedCheckout(session: Stripe.Checkout.Session): Promise<string | null> {
  const companyId = session.client_reference_id ?? session.metadata?.companyId ?? null;
  const stripe = getStripeClient();
  if (!companyId || !stripe) return null;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : (session.subscription?.id ?? null);
  if (!subscriptionId) return null;
  await syncSubscription(companyId, await stripe.subscriptions.retrieve(subscriptionId), session.metadata?.plan);
  return companyId;
}

/**
 * Sucht das aktuelle Stripe-Abo eines Büros (über die companyId in den Abo-Metadaten) und übernimmt es –
 * Absicherung, falls ein Webhook von Stripe nicht ankommt. Gibt true zurück, wenn ein Abo gefunden wurde.
 */
export async function syncLatestSubscription(companyId: string): Promise<boolean> {
  const stripe = getStripeClient();
  if (!stripe || !/^[0-9a-f-]{36}$/i.test(companyId)) return false;
  const found = await stripe.subscriptions.search({ query: `metadata['companyId']:'${companyId}'`, limit: 20 });
  const rank = (s: Stripe.Subscription) => (["active", "trialing", "past_due"].includes(s.status) ? 1 : 0);
  const latest = [...found.data].sort((a, b) => rank(b) - rank(a) || b.created - a.created)[0];
  if (!latest) return false;
  await syncSubscription(companyId, latest);
  return true;
}

/** Regelmäßiger Abgleich (Cron, stündlich): Stand aller Stripe-Abos übernehmen – fängt verpasste Webhooks (Kündigung, Zahlung offen) ab. */
export async function syncAllSubscriptions(): Promise<{ synced: number; errors: number }> {
  const admin = createAdminClient();
  const stripe = getStripeClient();
  const totals = { synced: 0, errors: 0 };
  if (!admin || !stripe) return totals;
  const { data } = await admin.from("subscriptions").select("company_id, stripe_subscription_id").not("stripe_subscription_id", "is", null);
  for (const row of data ?? []) {
    try {
      await syncSubscription(row.company_id, await stripe.subscriptions.retrieve(row.stripe_subscription_id));
      totals.synced++;
    } catch (err) {
      totals.errors++;
      console.error(`[stripe-sync] Büro ${row.company_id}:`, err instanceof Error ? err.message : "Fehler");
    }
  }
  return totals;
}
