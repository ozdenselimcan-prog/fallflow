import type { Company, Subscription } from "@/lib/data/types";
import { stripeConfigured } from "@/lib/integrations/stripe";

/**
 * Ab diesem Zeitpunkt angelegte Büros brauchen nach der Testphase eine hinterlegte Zahlungsmethode, damit FallFlow weiter
 * für sie arbeitet. Ältere Konten (u. a. Test- und Pilotkonten von vor der Einführung) bleiben unverändert nutzbar.
 */
export const PAYMENT_REQUIRED_SINCE = "2026-10-11T20:00:00.000Z";
/** Standard-Testphase ohne Zahlungsmethode; über den Registrierungslink auch länger (?trial=14, Empfehlungslink). */
export const DEFAULT_TRIAL_DAYS = 7;

type CompanyLike = Pick<Company, "createdAt">;
type SubscriptionLike = Pick<Subscription, "stripeCustomerId" | "status" | "currentPeriodEnd">;

/**
 * Ende der kostenlosen Testphase OHNE hinterlegte Zahlungsmethode – null, wenn das Büro bereits bei Stripe zahlt bzw.
 * eine Zahlungsmethode hinterlegt hat, oder wenn es (als älteres Konto) gar keine braucht. Das Ende wird bei der
 * Registrierung in subscriptions.current_period_end gespeichert; fehlt es, gilt Anlage + 7 Tage.
 */
export function cardlessTrialEnd(company: CompanyLike, subscription: SubscriptionLike): string | null {
  if (!stripeConfigured()) return null;
  if (subscription.stripeCustomerId || subscription.status === "active") return null;
  if (company.createdAt < PAYMENT_REQUIRED_SINCE) return null;
  return subscription.currentPeriodEnd ?? new Date(Date.parse(company.createdAt) + DEFAULT_TRIAL_DAYS * 86_400_000).toISOString();
}

/** Verbleibende Tage der Testphase ohne Zahlungsmethode (aufgerundet), 0 = abgelaufen, null = nicht in so einer Testphase. */
export function trialDaysLeft(company: CompanyLike, subscription: SubscriptionLike, now = Date.now()): number | null {
  const end = cardlessTrialEnd(company, subscription);
  if (!end) return null;
  return Math.max(0, Math.ceil((Date.parse(end) - now) / 86_400_000));
}

/**
 * true = Die kostenlose Testphase ist abgelaufen und es ist noch keine Zahlungsmethode hinterlegt. Dann sind Dashboard
 * (nur noch die Bezahlseite), Mail-Abruf und Website-Chat gesperrt, bis ein Plan gewählt und bezahlt wurde.
 */
export function needsPaymentSetup(company: CompanyLike, subscription: SubscriptionLike, now = Date.now()): boolean {
  const end = cardlessTrialEnd(company, subscription);
  return end !== null && now >= Date.parse(end);
}

/**
 * true = Das Büro hat gar keine Testphase (Registrierung über "Direkt kaufen" oder die E-Mail-Adresse hat schon einmal
 * getestet): Das Testphasen-Ende liegt dann praktisch auf dem Anlagezeitpunkt. Dann geht es direkt zur Bezahlung –
 * noch vor dem Einrichten.
 */
export function isDirectPurchase(company: CompanyLike, subscription: SubscriptionLike): boolean {
  const end = cardlessTrialEnd(company, subscription);
  return end !== null && Date.parse(end) - Date.parse(company.createdAt) < 3_600_000;
}
