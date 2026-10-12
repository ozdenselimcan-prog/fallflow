import { describe, expect, it } from "vitest";
import { unwrapForwardedMail } from "./forwarded";

describe("unwrapForwardedMail", () => {
  it("holt Kunde, Betreff und Text aus einer Outlook-Weiterleitung", () => {
    const body = [
      "",
      "________________________________",
      "Von: Max Mustermann <max@example.com>",
      "Gesendet: Montag, 12. Oktober 2026 10:00",
      "An: info@deinenergieberater.com",
      "Betreff: Anfrage iSFP",
      "",
      "Hallo, ich möchte einen iSFP für mein Haus.",
      "Viele Grüße",
    ].join("\r\n");
    expect(unwrapForwardedMail("WG: Anfrage iSFP", body)).toEqual({
      from: "max@example.com",
      fromName: "Max Mustermann",
      subject: "Anfrage iSFP",
      body: "Hallo, ich möchte einen iSFP für mein Haus.\nViele Grüße",
    });
  });

  it("versteht die Gmail-Variante und eine Adresse ohne Namen", () => {
    const body = "---------- Forwarded message ---------\nFrom: anna@beispiel.de\nDate: Mon, Oct 12, 2026\nSubject: Energieausweis\nTo: <info@buero.de>\n\nBrauche einen Energieausweis.";
    const r = unwrapForwardedMail("Fwd: Energieausweis", body);
    expect(r?.from).toBe("anna@beispiel.de");
    expect(r?.subject).toBe("Energieausweis");
    expect(r?.body).toBe("Brauche einen Energieausweis.");
  });

  it("liefert null, wenn kein ursprünglicher Absender im Text steht", () => {
    expect(unwrapForwardedMail("Hallo", "Nur eine normale Nachricht.")).toBeNull();
  });
});
