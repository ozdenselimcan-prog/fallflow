import { apiError, json, parseBody, withSession } from "@/lib/api";
import { cardlessTrialEnd } from "@/lib/billing/access";
import { siteConfig } from "@/lib/config/site";
import { createCheckoutSession } from "@/lib/integrations/stripe";
import { checkoutSchema } from "@/lib/validation";

/** Stripe verlangt, dass ein festes Testphasen-Ende mindestens zwei Tage in der Zukunft liegt. */
const MIN_TRIAL_MS = 2 * 86_400_000 + 60 * 60_000;

/**
 * Zahlungsmethode hinterlegen und Plan wählen – während der kostenlosen Testphase (abgebucht wird erst zu deren Ende,
 * es gibt keine zusätzlichen Gratistage) oder danach (dann ohne weitere Testphase, die erste Zahlung wird sofort fällig).
 */
export const POST = withSession(
  async (req, { session, store }) => {
    const body = await parseBody(req, checkoutSchema);
    if (!body.ok) return body.res;
    const [company, subscription] = await Promise.all([store.getCompany(), store.getSubscription()]);
    const end = cardlessTrialEnd(company, subscription);
    if (!end) return apiError("Für Ihr Büro ist bereits ein Abo hinterlegt.", 400);
    const endMs = Date.parse(end);
    try {
      const url = await createCheckoutSession({
        companyId: session.companyId,
        planId: body.data.plan,
        customerEmail: session.email,
        existingCustomerId: null,
        // Restliche Testphase übernehmen; ist sie (fast) vorbei, startet das Abo direkt.
        ...(endMs - Date.now() >= MIN_TRIAL_MS ? { trialEnd: Math.floor(endMs / 1000) } : {}),
        // Rückkehr prüft den Checkout sofort selbst bei Stripe (unabhängig vom Webhook).
        successUrl: `${siteConfig.appUrl}/api/billing/confirm?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${siteConfig.appUrl}/dashboard`,
      });
      return json({ url });
    } catch (err) {
      console.error("[billing/start-trial]", err instanceof Error ? err.message : "Fehler");
      return apiError("Die Bezahlseite konnte nicht geöffnet werden. Bitte später erneut versuchen.", 500);
    }
  },
  { permission: "billing:manage" },
);
