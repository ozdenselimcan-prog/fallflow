import type { Company, Subscription } from "@/lib/data/types";
import { stripeConfigured } from "@/lib/integrations/stripe";

/**
 * Ab diesem Zeitpunkt angelegte Büros brauchen eine hinterlegte Zahlungsmethode (Stripe-Testphase), bevor FallFlow
 * für sie arbeitet. Ältere Konten (u. a. Test- und Pilotkonten von vor der Einführung) bleiben unverändert nutzbar.
 */
export const PAYMENT_REQUIRED_SINCE = "2026-10-11T20:00:00.000Z";

/**
 * true = Das Büro hat die Bezahlseite bei der Registrierung abgebrochen und noch keine Zahlungsmethode hinterlegt.
 * Dann sind Dashboard, Mail-Abruf und Website-Chat gesperrt, bis die Testphase über Stripe gestartet wurde.
 */
export function needsPaymentSetup(company: Pick<Company, "createdAt">, subscription: Pick<Subscription, "stripeCustomerId" | "status">): boolean {
  if (!stripeConfigured()) return false;
  if (subscription.stripeCustomerId || subscription.status === "active") return false;
  return company.createdAt >= PAYMENT_REQUIRED_SINCE;
}
