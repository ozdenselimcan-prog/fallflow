import { afterEach, describe, expect, it, vi } from "vitest";
import { extractBody, gmailProvider, type GmailPart } from "./gmail";

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("extractBody", () => {
  it("liest text/plain direkt aus", () => {
    const payload: GmailPart = { mimeType: "text/plain", body: { data: b64url("Hallo Welt") } };
    expect(extractBody(payload)).toBe("Hallo Welt");
  });

  it("findet text/plain in einer verschachtelten multipart-Struktur", () => {
    const payload: GmailPart = {
      mimeType: "multipart/mixed",
      parts: [
        { mimeType: "multipart/alternative", parts: [{ mimeType: "text/html", body: { data: b64url("<p>HTML-Version</p>") } }, { mimeType: "text/plain", body: { data: b64url("Klartext-Version") } }] },
        { mimeType: "application/pdf", body: { data: b64url("irrelevant") } },
      ],
    };
    expect(extractBody(payload)).toBe("Klartext-Version");
  });

  it("fällt auf text/html zurück und entfernt Tags, wenn kein text/plain vorhanden ist", () => {
    const payload: GmailPart = { mimeType: "multipart/alternative", parts: [{ mimeType: "text/html", body: { data: b64url("<div>Nur <b>HTML</b></div>") } }] };
    expect(extractBody(payload)).toBe("Nur HTML");
  });

  it("gibt leeren String ohne Payload oder ohne lesbaren Inhalt zurück", () => {
    expect(extractBody(undefined)).toBe("");
    expect(extractBody({ mimeType: "application/pdf", body: { data: b64url("irrelevant") } })).toBe("");
  });
});

describe("gmailProvider.missingConfig", () => {
  it("meldet fehlende App-Zugangsdaten, leer wenn beide gesetzt sind", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    expect(gmailProvider.missingConfig()).toEqual(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]);

    vi.stubEnv("GOOGLE_CLIENT_ID", "id123");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret123");
    expect(gmailProvider.missingConfig()).toEqual([]);
  });
});

describe("gmailProvider.getAuthUrl", () => {
  it("baut eine gültige Google-OAuth-URL mit Client-ID, Redirect und State", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "id123");
    const url = new URL(gmailProvider.getAuthUrl("state-abc", "https://app.example.com/api/integrations/gmail"));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("id123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/api/integrations/gmail");
    expect(url.searchParams.get("state")).toBe("state-abc");
    expect(url.searchParams.get("access_type")).toBe("offline");
  });
});
