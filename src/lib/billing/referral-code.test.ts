import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/stripe", () => ({ getStripeClient: () => null }));
vi.mock("@/lib/supabase/clients", () => ({ createAdminClient: () => null }));
const { normalizeReferralCode, referralCodeProblem, REFERRAL_CODE } = await import("./referrals");

describe("Empfehlungscode selbst wählen", () => {
  it("macht aus Büronamen einen gültigen Code", () => {
    expect(normalizeReferralCode(" Energie Müller GmbH ")).toBe("energie-mueller-gmbh");
    expect(normalizeReferralCode("Fuß & Söhne!!")).toBe("fuss-soehne");
  });
  it("prüft Länge, Zeichen und reservierte Namen", () => {
    expect(referralCodeProblem("ab")).not.toBeNull();
    expect(referralCodeProblem("-abc")).not.toBeNull();
    expect(referralCodeProblem("admin")).not.toBeNull();
    expect(referralCodeProblem("energie-mueller")).toBeNull();
  });
  it("alte automatisch erzeugte Codes bleiben gültig", () => {
    expect(REFERRAL_CODE.test("a1b2c3d4")).toBe(true);
  });
});
