import { afterEach, describe, expect, it, vi } from "vitest";
import { microsoftProvider } from "./microsoft";

const tokens = { accessToken: "at", refreshToken: "rt", expiresAt: null };
const b64 = (s: string) => Buffer.from(s).toString("base64");
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("microsoftProvider", () => {
  it("holt Mails mit PDF-Anhängen, meldet nicht übernehmbare Dateien und erkennt Auto-Antworten", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/mailFolders/inbox/messages")) {
        return ok({
          value: [
            { id: "m1", from: { emailAddress: { name: "Erika Beispiel", address: "erika@beispiel.de" } }, subject: "iSFP", body: { contentType: "text", content: "Anbei das Formular" }, receivedDateTime: "2026-10-11T10:00:00Z", hasAttachments: true, internetMessageHeaders: [] },
            { id: "m2", from: { emailAddress: { address: "abwesend@firma.de" } }, subject: "Abwesend", body: { contentType: "text", content: "Ich bin im Urlaub" }, receivedDateTime: "2026-10-11T10:05:00Z", hasAttachments: false, internetMessageHeaders: [{ name: "Auto-Submitted", value: "auto-replied" }] },
          ],
        });
      }
      if (url.includes("/messages/m1/attachments")) {
        return ok({
          value: [
            { "@odata.type": "#microsoft.graph.fileAttachment", name: "formular.pdf", contentType: "application/pdf", size: 1200, isInline: false, contentBytes: b64("%PDF-1.4") },
            { "@odata.type": "#microsoft.graph.fileAttachment", name: "IMG_1.heic", contentType: "image/heic", size: 50_000, isInline: false, contentBytes: b64("x") },
            { "@odata.type": "#microsoft.graph.fileAttachment", name: "logo.png", contentType: "image/png", size: 3_000, isInline: true, contentBytes: b64("x") },
          ],
        });
      }
      throw new Error(`unerwartet: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const mails = await microsoftProvider.fetchNewMessages(tokens, null);
    expect(mails).toHaveLength(2);
    expect(mails[0].from).toBe("Erika Beispiel <erika@beispiel.de>");
    expect(mails[0].attachments.map((a) => a.filename)).toEqual(["formular.pdf"]);
    expect(mails[0].skippedAttachments).toEqual(["IMG_1.heic"]);
    expect(mails[0].autoSubmitted).toBe(false);
    expect(mails[1].autoSubmitted).toBe(true);
  });

  it("verschickt Antworten mit Anhang und eigener Auto-Kennzeichnung", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    await microsoftProvider.sendReply(tokens, "kunde@beispiel.de", "Ihre Anfrage", "Hallo", [{ filename: "vorlage.pdf", mime: "application/pdf", bytes: new TextEncoder().encode("%PDF") }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/me/sendMail");
    const payload = JSON.parse(String(init.body));
    expect(payload.message.toRecipients[0].emailAddress.address).toBe("kunde@beispiel.de");
    expect(payload.message.attachments[0].name).toBe("vorlage.pdf");
    expect(payload.message.internetMessageHeaders[0].name).toBe("X-FallFlow-Auto");
  });
});
