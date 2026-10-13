import { getPlan } from "@/lib/config/pricing";
import { siteConfig } from "@/lib/config/site";
import { getStripeClient } from "@/lib/integrations/stripe";
import { createAdminClient } from "@/lib/supabase/clients";

/**
 * Empfehlungsprogramm: Jedes Büro hat einen Link fallflow.xyz/signup?ref=CODE (Tabellen siehe Migration 0023).
 * - Der geworbene Kollege testet 14 statt 7 Tage kostenlos.
 * - Wird er nach der Testphase zahlender Kunde, bekommt das empfehlende Büro einen Monatsbeitrag als Guthaben bei
 *   Stripe gutgeschrieben – es wird mit der nächsten Rechnung verrechnet.
 */
export const REFERRAL_TRIAL_DAYS = 14;
export const REFERRAL_CODE = /^[a-z0-9]{8}$/;

export const referralLink = (code: string) => `${siteConfig.appUrl}/signup?ref=${code}`;

export interface ReferralOverview {
  link: string;
  /** Über den Link registriert */
  signedUp: number;
  /** Davon zahlende Kunden geworden (= Monate gutgeschrieben) */
  rewarded: number;
}

export async function getReferralOverview(companyId: string): Promise<ReferralOverview | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const [{ data: code }, { data: refs }] = await Promise.all([
    admin.from("referral_codes").select("code").eq("company_id", companyId).maybeSingle(),
    admin.from("referrals").select("rewarded_at").eq("referrer_id", companyId),
  ]);
  if (!code?.code) return null;
  return { link: referralLink(code.code), signedUp: refs?.length ?? 0, rewarded: (refs ?? []).filter((r) => r.rewarded_at).length };
}

/**
 * Wird aufgerufen, sobald das Abo eines Büros "aktiv" ist (erste bezahlte Rechnung nach der Testphase). Wurde das Büro
 * geworben und gab es noch keine Gutschrift, bekommt das empfehlende Büro einen Monatsbeitrag als Stripe-Guthaben.
 * Ohne Stripe-Kunde beim Empfehlenden (noch keine Zahlungsmethode) bleibt es offen und wird später nachgeholt.
 */
export async function rewardReferralIfDue(companyId: string): Promise<void> {
  const admin = createAdminClient();
  const stripe = getStripeClient();
  if (!admin || !stripe) return;
  const { data: ref } = await admin.from("referrals").select("referrer_id").eq("company_id", companyId).is("rewarded_at", null).maybeSingle();
  if (!ref) return;
  const { data: sub } = await admin.from("subscriptions").select("plan, status, stripe_customer_id").eq("company_id", ref.referrer_id).maybeSingle();
  if (!sub?.stripe_customer_id || sub.status === "canceled") return;
  const amount = Math.round(getPlan(sub.plan).priceEur * 100);
  // Idempotenz-Schlüssel: auch bei gleichzeitigen Abgleichen (Webhook + Cron) höchstens eine Gutschrift.
  await stripe.customers.createBalanceTransaction(
    sub.stripe_customer_id,
    { amount: -amount, currency: "eur", description: "Empfehlungsbonus: 1 Monat FallFlow gratis" },
    { idempotencyKey: `referral-reward-${companyId}` },
  );
  await admin.from("referrals").update({ rewarded_at: new Date().toISOString() }).eq("company_id", companyId);
}
