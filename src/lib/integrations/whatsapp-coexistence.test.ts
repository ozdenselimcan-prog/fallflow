import { describe, expect, it } from "vitest";
import { parseCoexistence, parseWebhook } from "./whatsapp";

const wrap = (field: string, value: Record<string, unknown>) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA", changes: [{ field, value: { messaging_product: "whatsapp", metadata: { display_phone_number: "4915100000", phone_number_id: "PN1" }, ...value } }] }],
});

describe("WhatsApp-App parallel (Coexistence)", () => {
  it("liest Nachrichten, die der Betrieb in der App schreibt", () => {
    const ev = parseCoexistence(wrap("smb_message_echoes", { message_echoes: [{ from: "4915100000", to: "491701234567", id: "wamid.1", timestamp: "1", type: "text", text: { body: "Komme morgen um 9" } }] }));
    expect(ev).toEqual([{ phoneNumberId: "PN1", echoes: [{ id: "wamid.1", to: "491701234567", text: "Komme morgen um 9" }], contacts: [], historyContacts: [] }]);
  });

  it("liest Adressbuch und frühere Chats", () => {
    const contacts = parseCoexistence(wrap("smb_app_state_sync", { state_sync: [{ type: "contact", contact: { full_name: "Max", phone_number: "491701111111" }, action: "add" }, { type: "contact", contact: { phone_number: "491702222222" }, action: "remove" }] }));
    expect(contacts[0].contacts).toEqual([{ phone: "491701111111", remove: false }, { phone: "491702222222", remove: true }]);
    const history = parseCoexistence(wrap("history", { history: [{ metadata: { phase: "0" }, threads: [{ id: "491703333333", messages: [] }] }] }));
    expect(history[0].historyContacts).toEqual(["491703333333"]);
  });

  it("frühere Chats und eigene Nachrichten gelten nicht als neue Kundennachrichten", () => {
    expect(parseWebhook(wrap("history", { history: [{ threads: [{ id: "491703333333", messages: [{ from: "491703333333", id: "x", type: "text", text: { body: "alt" } }] }] }] }))).toEqual([]);
    expect(parseWebhook(wrap("smb_message_echoes", { message_echoes: [{ to: "49170", id: "y", type: "text", text: { body: "hi" } }] }))).toEqual([]);
  });
});
