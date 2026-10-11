import { beforeEach, describe, expect, it, vi } from "vitest";
import { answerCustomerQuestion } from "@/lib/ai/answer-question";
import { createMemoryStore } from "@/lib/data/memory";
import type { Store } from "@/lib/data/store";
import { answerWebsiteChat, chatContext } from "./website-chat";

vi.mock("@/lib/ai/answer-question", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/answer-question")>();
  return { ...actual, answerCustomerQuestion: vi.fn(async () => null) };
});

function freshStore(): Store {
  delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
  return createMemoryStore();
}

describe("Website-Chat (reiner Frage-Antwort-Assistent)", () => {
  let store: Store;
  beforeEach(() => {
    store = freshStore();
    vi.mocked(answerCustomerQuestion).mockReset();
    vi.mocked(answerCustomerQuestion).mockResolvedValue(null);
  });

  it("beantwortet Fragen mit der KI und legt keinen Fall an", async () => {
    const before = (await store.listCases()).length;
    vi.mocked(answerCustomerQuestion).mockResolvedValueOnce("Ein iSFP ist ein individueller Sanierungsfahrplan.");
    const history = [{ role: "user" as const, text: "Hallo" }];
    const reply = await answerWebsiteChat(store, "Was ist ein iSFP?", history);
    expect(reply).toContain("Sanierungsfahrplan");
    expect(vi.mocked(answerCustomerQuestion).mock.calls[0]?.[2]).toEqual(history);
    expect((await store.listCases()).length).toBe(before);
  });

  it("ohne KI: fester Hinweis auf E-Mail und Telefon für Anfragen und Termine", async () => {
    await store.updateCompany({ phone: "089 123456" });
    await store.setChannelStatus("gmail", "connected", "info@muster-energie.de");
    const reply = await answerWebsiteChat(store, "Ich möchte einen Termin");
    expect(reply).toContain("info@muster-energie.de");
    expect(reply).toContain("089 123456");
  });

  it("nennt nur ein tatsächlich verbundenes Postfach als E-Mail-Adresse", async () => {
    await store.setChannelStatus("gmail", "disconnected", "alt@example.com");
    expect((await chatContext(store)).email).toBe("");
  });
});
