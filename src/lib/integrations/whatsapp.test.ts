import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@/lib/data/memory";
import { attentionOf } from "@/lib/cases/attention";
import { routeInbound } from "@/lib/intake/router";
import { parseWebhook, validMetaSignature } from "./whatsapp";

const webhook = (messages: unknown[], contacts = [{ wa_id: "491701234567", profile: { name: "Erika" } }]) => ({
  object: "whatsapp_business_account",
  entry: [{ changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: "1111" }, contacts, messages } }] }],
});

describe("WhatsApp-Webhook lesen", () => {
  it("prüft die Signatur von Meta", () => {
    const raw = JSON.stringify(webhook([]));
    const sig = `sha256=${createHmac("sha256", "geheim").update(raw).digest("hex")}`;
    expect(validMetaSignature("geheim", raw, sig)).toBe(true);
    expect(validMetaSignature("geheim", raw + " ", sig)).toBe(false);
    expect(validMetaSignature("geheim", raw, null)).toBe(false);
  });
  it("liest Text, Fotos, Dokumente und erkennt nicht unterstützte Nachrichten", () => {
    const [g] = parseWebhook(
      webhook([
        { id: "m1", from: "491701234567", type: "text", text: { body: "Hallo" } },
        { id: "m2", from: "491701234567", type: "image", image: { id: "media1", mime_type: "image/jpeg", caption: "Der Schaden" } },
        { id: "m3", from: "491701234567", type: "document", document: { id: "media2", mime_type: "application/pdf", filename: "Formular.pdf" } },
        { id: "m4", from: "491701234567", type: "audio", audio: { id: "media3" } },
      ]),
    );
    expect(g.phoneNumberId).toBe("1111");
    expect(g.messages[0]).toMatchObject({ id: "m1", name: "Erika", text: "Hallo", media: null });
    expect(g.messages[1]).toMatchObject({ text: "Der Schaden", media: { id: "media1", mime: "image/jpeg" } });
    expect(g.messages[2].media?.filename).toBe("Formular.pdf");
    expect(g.messages[3].unsupported).toBe("audio");
  });
  it("ignoriert Status-Meldungen ohne Nachrichten", () => {
    expect(parseWebhook({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "1" }, statuses: [{}] } }] }] })).toEqual([]);
  });
});

describe("WhatsApp-Unterhaltung", () => {
  beforeEach(() => {
    delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
  });
  it("antwortet wie im Chat, aber als eine Nachricht, und fragt nicht nach der E-Mail", async () => {
    const store = createMemoryStore();
    const sender = { phone: "+491769876543", name: "Erika Beispiel" };
    const first = await routeInbound(store, { companyId: "demo", channel: "whatsapp", text: "Hallo, ich hätte gern eine Energieberatung für unser Einfamilienhaus.", sender });
    expect(first.matchedExisting).toBe(false);
    const msgs = (await store.listMessages(first.turn.sessionId)).filter((m) => m.role === "assistant");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].channel).toBe("whatsapp");
    const second = await routeInbound(store, { companyId: "demo", channel: "whatsapp", text: "1998", sender });
    expect(second.matchedExisting).toBe(true);
    expect(second.turn.sessionId).toBe(first.turn.sessionId);
    const all = (await store.listMessages(first.turn.sessionId)).map((m) => m.content).join(" ");
    expect(all).not.toMatch(/E-Mail-Adresse/);
    expect((await store.getCase(first.turn.sessionId))?.source).toBe("whatsapp");
  });
  it("Preisfrage gleich zu Beginn: Team antwortet selbst", async () => {
    const store = createMemoryStore();
    const r = await routeInbound(store, { companyId: "demo", channel: "whatsapp", text: "Hallo, was kostet bei Ihnen ein Energieausweis?", sender: { phone: "+491709999999" } });
    expect(attentionOf((await store.getCase(r.turn.sessionId))!.fields)).toBeTruthy();
    // Bei WhatsApp kommt trotzdem eine kurze Bestätigung – kein Schweigen im Chat.
    const bot = (await store.listMessages(r.turn.sessionId)).filter((m) => m.role === "assistant");
    expect(bot).toHaveLength(1);
    expect(bot[0].content).toMatch(/Team persönlich/);
  });

  it("Zwischenfragen mitten im Gespräch: beantworten bzw. ans Team geben und mit der offenen Frage weitermachen", async () => {
    const store = createMemoryStore();
    const sender = { phone: "+491765550123", name: "Ben" };
    const r = await routeInbound(store, { companyId: "demo", channel: "whatsapp", text: "Hallo, ich hätte gern eine Energieberatung für unser Einfamilienhaus.", sender });
    const id = r.turn.sessionId;
    const lastBot = async () => (await store.listMessages(id)).filter((m) => m.role === "assistant").at(-1)?.content ?? "";
    const pending = await lastBot();
    await routeInbound(store, { companyId: "demo", channel: "whatsapp", text: "Arbeiten Sie auch samstags?", sender });
    expect(await lastBot()).toContain("Zurück zu Ihrer Anfrage:");
    expect(attentionOf((await store.getCase(id))!.fields)).toBeFalsy();
    await routeInbound(store, { companyId: "demo", channel: "whatsapp", text: "Was kostet das bei Ihnen ungefähr?", sender });
    expect(await lastBot()).toMatch(/klärt unser Team/);
    expect(attentionOf((await store.getCase(id))!.fields)).toMatch(/Frage des Kunden/);
    // Die offene Frage wurde nicht mit der Zwischenfrage "beantwortet".
    expect(await lastBot()).toContain(pending.split("\n").at(-1)!.slice(0, 20));
  });
});

describe("KI-Pause im WhatsApp-Chat", () => {
  beforeEach(() => {
    delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
  });
  it("antwortet nicht, solange das Team übernommen hat, und meldet die Nachricht dem Team", async () => {
    const store = createMemoryStore();
    const sender = { phone: "+491765550999", name: "Lena" };
    const r = await routeInbound(store, { companyId: "demo", channel: "whatsapp", text: "Hallo, ich hätte gern eine Energieberatung.", sender });
    const id = r.turn.sessionId;
    await store.updateCase(id, { fields: { aiPaused: "1" } });
    const before = (await store.listMessages(id)).filter((m) => m.role === "assistant").length;
    await routeInbound(store, { companyId: "demo", channel: "whatsapp", text: "Danke, dann warte ich auf Ihren Anruf.", sender });
    expect((await store.listMessages(id)).filter((m) => m.role === "assistant")).toHaveLength(before);
    expect(attentionOf((await store.getCase(id))!.fields)).toMatch(/WhatsApp-Chat geantwortet/);
    await store.updateCase(id, { fields: { aiPaused: "", needsAttention: "" } });
    await routeInbound(store, { companyId: "demo", channel: "whatsapp", text: "1998", sender });
    expect((await store.listMessages(id)).filter((m) => m.role === "assistant").length).toBeGreaterThan(before);
  });
});
