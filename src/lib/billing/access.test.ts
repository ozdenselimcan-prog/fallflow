import { afterEach, describe, expect, it, vi } from "vitest";
import { needsPaymentSetup, PAYMENT_REQUIRED_SINCE } from "./access";

const later = "2026-12-01T00:00:00.000Z";
const earlier = "2026-01-01T00:00:00.000Z";

afterEach(() => vi.unstubAllEnvs());

describe("needsPaymentSetup", () => {
  it("neues Büro ohne Zahlungsmethode muss erst die Testphase starten", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test");
    expect(needsPaymentSetup({ createdAt: later }, { stripeCustomerId: null, status: "trialing" })).toBe(true);
  });
  it("mit hinterlegter Zahlungsmethode: frei", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test");
    expect(needsPaymentSetup({ createdAt: later }, { stripeCustomerId: "cus_1", status: "trialing" })).toBe(false);
  });
  it("Konten von vor der Einführung bleiben unverändert nutzbar", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test");
    expect(earlier < PAYMENT_REQUIRED_SINCE).toBe(true);
    expect(needsPaymentSetup({ createdAt: earlier }, { stripeCustomerId: null, status: "trialing" })).toBe(false);
  });
  it("ohne Stripe-Konfiguration (Demo/Entwicklung) nie gesperrt", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(needsPaymentSetup({ createdAt: later }, { stripeCustomerId: null, status: "trialing" })).toBe(false);
  });
});
