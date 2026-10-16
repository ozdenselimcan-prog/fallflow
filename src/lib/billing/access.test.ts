import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/stripe", () => ({ stripeConfigured: () => true }));
const { cardlessTrialEnd, isDirectPurchase, needsPaymentSetup, trialDaysLeft } = await import("./access");

const DAY = 86_400_000;
const created = "2026-10-15T10:00:00.000Z";
const t0 = Date.parse(created);
const noCard = { stripeCustomerId: null, status: "trialing" as const, currentPeriodEnd: null };

describe("Testphase ohne Zahlungsmethode", () => {
  it("läuft standardmäßig 7 Tage ab Anlage und ist währenddessen nutzbar", () => {
    expect(cardlessTrialEnd({ createdAt: created }, noCard)).toBe(new Date(t0 + 7 * DAY).toISOString());
    expect(needsPaymentSetup({ createdAt: created }, noCard, t0 + 3 * DAY)).toBe(false);
    expect(trialDaysLeft({ createdAt: created }, noCard, t0 + 3 * DAY)).toBe(4);
  });
  it("nutzt das gespeicherte Ende (z. B. 14 Tage über den Registrierungslink)", () => {
    const sub = { ...noCard, currentPeriodEnd: new Date(t0 + 14 * DAY).toISOString() };
    expect(needsPaymentSetup({ createdAt: created }, sub, t0 + 10 * DAY)).toBe(false);
    expect(trialDaysLeft({ createdAt: created }, sub, t0 + 10 * DAY)).toBe(4);
  });
  it("sperrt nach Ablauf bis zur Zahlung", () => {
    expect(needsPaymentSetup({ createdAt: created }, noCard, t0 + 7 * DAY + 1)).toBe(true);
    expect(trialDaysLeft({ createdAt: created }, noCard, t0 + 8 * DAY)).toBe(0);
  });
  it("mit hinterlegter Zahlungsmethode oder aktivem Abo keine Testphasen-Sperre", () => {
    expect(cardlessTrialEnd({ createdAt: created }, { ...noCard, stripeCustomerId: "cus_123" })).toBeNull();
    expect(needsPaymentSetup({ createdAt: created }, { ...noCard, status: "active" }, t0 + 30 * DAY)).toBe(false);
  });
  it("ältere Konten (vor Einführung) sind nie betroffen", () => {
    expect(cardlessTrialEnd({ createdAt: "2026-10-01T00:00:00.000Z" }, noCard)).toBeNull();
  });
});

describe("Direkt kaufen (ohne Testphase)", () => {
  it("Testphasen-Ende = Anlage → sofort zur Bezahlung, vor dem Einrichten", () => {
    const sub = { ...noCard, currentPeriodEnd: new Date(t0 + 5000).toISOString() };
    expect(isDirectPurchase({ createdAt: created }, sub)).toBe(true);
    expect(needsPaymentSetup({ createdAt: created }, sub, t0 + 60_000)).toBe(true);
  });
  it("normale Testphase ist kein Direktkauf", () => {
    expect(isDirectPurchase({ createdAt: created }, noCard)).toBe(false);
    expect(isDirectPurchase({ createdAt: created }, { ...noCard, stripeCustomerId: "cus_1" })).toBe(false);
  });
});
