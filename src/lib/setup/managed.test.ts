import { beforeAll, describe, expect, it } from "vitest";

describe("Zugangslink aus der Freischaltungs-Mail", () => {
  beforeAll(() => {
    process.env.CONNECTIONS_SECRET = "test-secret";
  });

  it("gültig für die eigene Company, 14 Tage lang", async () => {
    const { accessToken, readAccessToken } = await import("./managed");
    const id = "6f1c2a7e-1111-4222-8333-444455556666";
    const now = Date.parse("2026-12-01T10:00:00Z");
    const token = accessToken(id, now);
    expect(readAccessToken(token, now + 13 * 86_400_000)).toBe(id);
    expect(readAccessToken(token, now + 15 * 86_400_000)).toBeNull();
  });

  it("verändert oder gefälscht: ungültig", async () => {
    const { accessToken, readAccessToken } = await import("./managed");
    const token = accessToken("6f1c2a7e-1111-4222-8333-444455556666");
    const [, exp, sig] = token.split(".");
    expect(readAccessToken(`aaaaaaaa-1111-4222-8333-444455556666.${exp}.${sig}`)).toBeNull();
    expect(readAccessToken("kaputt")).toBeNull();
  });

  it("Fragebogen: Zustimmung zu AGB/AVV ist Pflicht, Spam-Feld muss leer sein", async () => {
    const { managedSetupSchema } = await import("./managed");
    const base = { company: "Dach Müller", firstName: "Max", lastName: "Müller", email: "MAX@Beispiel.de", phone: "089 123456", services: ["Dachreparatur"] };
    expect(managedSetupSchema.safeParse({ ...base, terms: false }).success).toBe(false);
    expect(managedSetupSchema.safeParse({ ...base, terms: true, hp: "spam" }).success).toBe(false);
    const ok = managedSetupSchema.safeParse({ ...base, terms: true });
    expect(ok.success && ok.data.email).toBe("max@beispiel.de");
  });
});
