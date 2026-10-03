import { describe, expect, it } from "vitest";
import { encodeCredentials, gmailProvider } from "./gmail";

describe("gmailProvider.missingConfig", () => {
  it("ist immer leer – jedes Büro bringt seine eigenen IMAP/SMTP-Zugangsdaten mit, kein globales App-Secret nötig", () => {
    expect(gmailProvider.missingConfig()).toEqual([]);
  });
});

describe("encodeCredentials", () => {
  it("kodiert die Zugangsdaten als JSON, das testConnection/fetchNewMessages/sendReply wieder einlesen können", () => {
    const creds = { email: "buero@beispiel.de", password: "geheim", imapHost: "imap.beispiel.de", imapPort: 993, smtpHost: "smtp.beispiel.de", smtpPort: 465 };
    const encoded = encodeCredentials(creds);
    expect(JSON.parse(encoded)).toEqual(creds);
  });
});
