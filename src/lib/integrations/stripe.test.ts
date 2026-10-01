import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Reine/lokale Logik ohne echte Netzwerkaufrufe an Stripe: Konfigurationsprüfung, Preis-Zuordnung und
 * Webhook-Signaturprüfung (reine Kryptografie, kein Request). Checkout-/Portal-Sessions selbst (echte
 * Stripe-API-Aufrufe) werden hier bewusst nicht getestet – die wurden live gegen die echte Stripe-API
 * geprüft, siehe Commit-Historie.
 */

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("stripeConfigured", () => {
  it("false ohne STRIPE_SECRET_KEY, true mit gesetztem Key", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const mod1 = await import("./stripe");
    expect(mod1.stripeConfigured()).toBe(false);

    vi.resetModules();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    const mod2 = await import("./stripe");
    expect(mod2.stripeConfigured()).toBe(true);
  });
});

describe("getStripeClient", () => {
  it("liefert null ohne Key, einen Client mit gesetztem Key", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const mod1 = await import("./stripe");
    expect(mod1.getStripeClient()).toBeNull();

    vi.resetModules();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    const mod2 = await import("./stripe");
    expect(mod2.getStripeClient()).not.toBeNull();
  });
});

describe("priceIdForPlan / planForPriceId", () => {
  it("löst Plan → Preis-ID und zurück auf, ohne konfigurierte Preise null", async () => {
    vi.stubEnv("STRIPE_PRICE_STARTER", "price_starter_123");
    vi.stubEnv("STRIPE_PRICE_PRO", "price_pro_456");
    delete process.env.STRIPE_PRICE_BUSINESS;
    const { priceIdForPlan, planForPriceId } = await import("./stripe");

    expect(priceIdForPlan("starter")).toBe("price_starter_123");
    expect(priceIdForPlan("pro")).toBe("price_pro_456");
    expect(priceIdForPlan("business")).toBeNull();

    expect(planForPriceId("price_starter_123")).toBe("starter");
    expect(planForPriceId("price_pro_456")).toBe("pro");
    expect(planForPriceId("price_unknown")).toBeNull();
  });
});

describe("verifyStripeWebhook", () => {
  const SECRET = "whsec_test_secret";
  const PAYLOAD = JSON.stringify({ id: "evt_test", type: "checkout.session.completed", data: { object: {} } });

  it("wirft ohne Konfiguration (kein Secret oder kein Signatur-Header)", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const { verifyStripeWebhook } = await import("./stripe");
    expect(() => verifyStripeWebhook(PAYLOAD, "sig")).toThrow();
    expect(() => verifyStripeWebhook(PAYLOAD, null)).toThrow();
  });

  it("akzeptiert eine korrekt signierte Nutzlast und wirft bei manipulierter Nutzlast/Signatur", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
    const { verifyStripeWebhook } = await import("./stripe");

    const signature = Stripe.webhooks.generateTestHeaderString({ payload: PAYLOAD, secret: SECRET });
    const event = verifyStripeWebhook(PAYLOAD, signature);
    expect(event.type).toBe("checkout.session.completed");

    // Nutzlast nach dem Signieren verändert ("manipulierter Webhook") – muss abgelehnt werden.
    const tampered = PAYLOAD.replace("checkout.session.completed", "customer.subscription.deleted");
    expect(() => verifyStripeWebhook(tampered, signature)).toThrow();

    // Falsches Secret ergibt eine ungültige Signatur.
    const wrongSignature = Stripe.webhooks.generateTestHeaderString({ payload: PAYLOAD, secret: "whsec_wrong" });
    expect(() => verifyStripeWebhook(PAYLOAD, wrongSignature)).toThrow();
  });
});
