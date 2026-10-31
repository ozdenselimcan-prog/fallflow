import { describe, expect, it } from "vitest";
import { friendlyConnectError, providerForEmail, providerForMx } from "./mail-providers";

describe("E-Mail-Anbieter erkennen", () => {
  it("an der Adresse", () => {
    expect(providerForEmail("max@gmx.de")?.id).toBe("gmx");
    expect(providerForEmail("Max@Web.de")?.id).toBe("webde");
    expect(providerForEmail("a@t-online.de")?.id).toBe("tonline");
    expect(providerForEmail("a@gmail.com")?.id).toBe("gmail");
    expect(providerForEmail("a@hotmail.de")?.microsoft).toBe(true);
    expect(providerForEmail("info@malerbetrieb-pinsel.de")).toBeNull();
  });

  it("an den MX-Einträgen eigener Domains", () => {
    expect(providerForMx(["mx00.ionos.de"])?.id).toBe("ionos");
    expect(providerForMx(["mx01.kundenserver.de."])?.id).toBe("ionos");
    expect(providerForMx(["smtpin.rzone.de"])?.id).toBe("strato");
    expect(providerForMx(["aspmx.l.google.com"])?.id).toBe("gmail");
    expect(providerForMx(["firma-de.mail.protection.outlook.com"])?.id).toBe("microsoft");
    expect(providerForMx(["mail.eigener-server.de"])).toBeNull();
  });

  it("verständliche Fehlermeldungen", () => {
    expect(friendlyConnectError("Invalid credentials (Failure)", "imap.gmx.net")).toMatch(/POP3 & IMAP/);
    expect(friendlyConnectError("AUTHENTICATIONFAILED", "imap.gmail.com")).toMatch(/App-Passwort/);
    expect(friendlyConnectError("getaddrinfo ENOTFOUND imap.xyz.de", "imap.xyz.de")).toMatch(/nicht gefunden/);
  });
});
