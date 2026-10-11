import { apiError, json, parseBody, withSession } from "@/lib/api";
import { needsPaymentSetup } from "@/lib/billing/access";
import { siteConfig } from "@/lib/config/site";
import { createCheckoutSession } from "@/lib/integrations/stripe";
import { checkoutSchema } from "@/lib/validation";

/**
 * Testphase starten (nach dem Onboarding bzw. wenn die Bezahlseite abgebrochen wurde). 7 Tage kostenlos (oder der
 * Testzeitraum aus dem Registrierungslink), Zahlungsmethode wird hinterlegt; ohne Kündigung geht es danach in den Plan über.
 */
export const POST = withSession(
  async (req, { session, store }) => {
    const body = await parseBody(req, checkoutSchema);
    if (!body.ok) return body.res;
    const [company, subscription] = await Promise.all([store.getCompany(), store.getSubscription()]);
    if (!needsPaymentSetup(company, subscription)) return apiError("Für Ihr Büro ist bereits ein Abo hinterlegt.", 400);
    try {
      const url = await createCheckoutSession({
        companyId: session.companyId,
        planId: body.data.plan,
        customerEmail: session.email,
        existingCustomerId: null,
        trialDays: session.trialDays && session.trialDays >= 1 && session.trialDays <= 30 ? session.trialDays : 7,
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
