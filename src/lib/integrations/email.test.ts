import { describe, expect, it } from "vitest";
import { friendlyMailError, replySubject, stripHtml } from "./email";

describe("stripHtml", () => {
  it("entfernt Tags und normalisiert Whitespace", () => {
    expect(stripHtml("<p>Hallo  <b>Welt</b></p>\n\n<p>Zweiter Absatz</p>")).toBe("Hallo Welt Zweiter Absatz");
  });

  it("gibt leeren String für leeren Input zurück", () => {
    expect(stripHtml("")).toBe("");
  });

  it("lässt reinen Text unverändert (bis auf Whitespace)", () => {
    expect(stripHtml("Einfacher   Text")).toBe("Einfacher Text");
  });
});

describe("replySubject", () => {
  it("setzt Re: vor den Betreff des Kunden, aber nicht doppelt", () => {
    expect(replySubject("iSFP Anfrage", "Ihre Anfrage")).toBe("Re: iSFP Anfrage");
    expect(replySubject("AW: iSFP Anfrage", "Ihre Anfrage")).toBe("AW: iSFP Anfrage");
    expect(replySubject("  ", "Ihre Anfrage")).toBe("Ihre Anfrage");
  });
});

describe("friendlyMailError", () => {
  it("erklärt eine Microsoft-Sperre verständlich", () => {
    expect(friendlyMailError("Microsoft-Anmeldung fehlgeschlagen (HTTP 400): AADSTS70000: User account is found to be in service abuse mode.")).toMatch(/vorübergehend gesperrt/);
    expect(friendlyMailError('HTTP 403 ({"error":{"code":"ErrorAccountSuspend"')).toMatch(/vorübergehend gesperrt/);
    expect(friendlyMailError("AADSTS700082: The refresh token has expired")).toMatch(/erneut „Mit Microsoft anmelden“/);
    expect(friendlyMailError("Invalid login")).toBe("Invalid login");
  });
});
