import { describe, expect, it } from "vitest";
import { guessLanguage, inCustomerLanguage } from "./language";

describe("Sprache des Kunden", () => {
  it("erkennt Deutsch und Englisch ohne KI", () => {
    expect(guessLanguage("Guten Tag, bei uns ist die Heizung ausgefallen. Können Sie bitte vorbeikommen?")).toBe("de");
    expect(guessLanguage("Dachrinne verstopft, Wasser läuft über die Fassade, bitte melden")).toBe("de");
    expect(guessLanguage("Hello, our roof is leaking since the storm. Could you please send someone? Thanks")).toBe("en");
  });

  it("kurze Nachrichten ändern die Sprache nicht", () => {
    expect(guessLanguage("Ok")).toBe("short");
    expect(guessLanguage("12345 Berlin")).toBe("short");
    expect(guessLanguage("Tamam, teşekkürler")).toBe("short");
  });

  it("unklare Sprachen fragt die KI", () => {
    expect(guessLanguage("Merhaba, çatımızda hasar var, fırtınadan sonra kiremitler düştü. Ne zaman gelebilirsiniz?")).toBeNull();
  });

  it("Deutsch bzw. ohne Sprache bleibt der Text unverändert", async () => {
    expect(await inCustomerLanguage({}, "Vielen Dank!")).toBe("Vielen Dank!");
    expect(await inCustomerLanguage({ lang: "de" }, "Vielen Dank!")).toBe("Vielen Dank!");
  });
});
