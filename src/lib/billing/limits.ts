import type { Subscription } from "@/lib/data/types";

export type PlanId = Subscription["plan"];

const CASE_LIMITS: Record<PlanId, number | null> = { starter: 100, pro: 500, business: null };

/** Monatliches Fall-Limit des Plans, null = unbegrenzt (Business). */
export function caseLimitFor(plan: PlanId): number | null {
  return CASE_LIMITS[plan];
}

/** KI-Werkzeuge (Voreinschätzung, Förderschätzung, Bauteilwerte) und PDF-Vorlagen/Nachrichtentexte je
 * Leistung sind ab dem Pro-Plan dabei – der Starter-Plan deckt nur die reine Mail-Automatisierung ab. */
export function hasAiTools(plan: PlanId): boolean {
  return plan === "pro" || plan === "business";
}

/** Wird dem Kunden geantwortet, wenn das Büro sein monatliches Fall-Kontingent erreicht hat. */
export const CASE_LIMIT_REACHED_TEXT =
  "Vielen Dank für Ihre Nachricht! Unser Büro hat die monatliche Kapazität für neue Anfragen aktuell erreicht. Bitte kontaktieren Sie uns direkt telefonisch oder versuchen Sie es zu Beginn des nächsten Monats erneut.";
