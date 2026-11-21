import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({ getPublicStore: vi.fn() }));
vi.mock("@/lib/supabase/clients", () => ({ createAdminClient: () => null }));

const { gmailConfirmation, slugForAddress } = await import("./forwarding");

describe("slugForAddress", () => {
  it("macht aus dem Betriebsnamen einen kurzen Adress-Teil", () => {
    expect(slugForAddress("Dachdeckerei Müller GmbH")).toBe("dachdeckerei-mueller");
    expect(slugForAddress("Heizung & Sanitär Groß e.K.")).toBe("heizung-sanitaer-gross");
  });

  it("kürzt lange Namen und fällt bei leerem Namen auf „betrieb“ zurück", () => {
    expect(slugForAddress("Allerbeste Malerwerkstatt Oberschleißheim").length).toBeLessThanOrEqual(24);
    expect(slugForAddress("GmbH")).toBe("betrieb");
    expect(slugForAddress("")).toBe("betrieb");
  });
});

describe("gmailConfirmation", () => {
  it("liest Code und Link aus der Bestätigungsmail von Gmail", () => {
    const r = gmailConfirmation(
      "Gmail Team <forwarding-noreply@google.com>",
      "(#482915733) Gmail-Weiterleitungsbestätigung – E-Mails von info@beispiel.de empfangen",
      "Klicken Sie auf den Link: https://mail-settings.google.com/mail/vf-%5BANGjdJ8%5D-abc123 um die Anfrage zu bestätigen.",
    );
    expect(r).toEqual({ code: "482915733", link: "https://mail-settings.google.com/mail/vf-%5BANGjdJ8%5D-abc123" });
  });

  it("ignoriert normale Mails", () => {
    expect(gmailConfirmation("kunde@example.com", "(#123456789) Anfrage", "Hallo")).toBeNull();
  });
});
