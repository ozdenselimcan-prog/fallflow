import { beforeEach, describe, expect, it, vi } from "vitest";
import { answerCustomerQuestion, looksLikeQuestion } from "@/lib/ai/answer-question";
import { createMemoryStore } from "@/lib/data/memory";
import type { Store } from "@/lib/data/store";
import { processIntakeMessage } from "./engine";

vi.mock("@/lib/ai/answer-question", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/answer-question")>();
  return { ...actual, answerCustomerQuestion: vi.fn(async () => null) };
});

function freshStore(): Store {
  delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
  return createMemoryStore();
}

describe("looksLikeQuestion", () => {
  it.each([
    ["Welche Leistungen bieten Sie an?", true],
    ["Welche Leistungen bieten Sie an", true],
    ["Was kostet ein iSFP", true],
    ["Wie lange dauert das?", true],
    ["Max Mustermann", false],
    ["1985", false],
    ["Einfamilienhaus", false],
  ])("%s → %s", (text, expected) => {
    expect(looksLikeQuestion(text)).toBe(expected);
  });
});

describe("Website-Chat: Kundenfragen", () => {
  let store: Store;
  beforeEach(() => {
    store = freshStore();
    vi.mocked(answerCustomerQuestion).mockReset();
    vi.mocked(answerCustomerQuestion).mockResolvedValue(null);
  });

  it("beantwortet eine Frage mit der KI und stellt danach die nächste Frage zur Anfrage", async () => {
    vi.mocked(answerCustomerQuestion).mockResolvedValueOnce("Wir bieten Energieberatung, iSFP und Energieausweise an.");
    const turn = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Welche Leistungen bieten Sie an?", source: "widget", channel: "website" });
    expect(turn.replies[0]).toBe("Wir bieten Energieberatung, iSFP und Energieausweise an.");
    expect(turn.replies.at(-1)).toMatch(/Wenn Sie möchten, nehme ich Ihre Anfrage gleich auf/);
    // Die Ausgangsfrage steht dem Kunden weiterhin als Auswahl zur Verfügung (z. B. Leistungs-Buttons).
    expect(turn.quickReplies.length).toBeGreaterThan(0);
  });

  it("eine Frage mitten im Gespräch wird NICHT als Antwort auf die offene Frage gespeichert (z. B. als Name)", async () => {
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Energieberatung für mein Einfamilienhaus.", source: "widget", channel: "website" });
    const pendingBefore = first.fields;
    vi.mocked(answerCustomerQuestion).mockResolvedValueOnce("Ein iSFP ist ein individueller Sanierungsfahrplan für Ihr Gebäude.");
    const turn = await processIntakeMessage(store, { companyId: "demo", sessionId: first.sessionId, text: "Was ist eigentlich ein iSFP?", source: "widget", channel: "website" });
    expect(turn.replies[0]).toContain("Sanierungsfahrplan");
    expect(turn.replies.at(-1)).toMatch(/^Zurück zu Ihrer Anfrage: /);
    // Keine Angabe wurde durch die Frage überschrieben oder befüllt.
    expect(Object.values(turn.fields)).not.toContain("Was ist eigentlich ein iSFP?");
    expect(turn.fields.yearBuilt).toBe(pendingBefore.yearBuilt);
  });

  it("kurze Antwort mit Fragezeichen auf eine Zahlenfrage bleibt eine Antwort", async () => {
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Energieberatung für mein Einfamilienhaus", source: "widget", channel: "website" });
    expect(first.fields.service).toBe("Energieberatung");
    const turn = await processIntakeMessage(store, { companyId: "demo", sessionId: first.sessionId, text: "1985?", source: "widget", channel: "website" });
    expect(turn.fields.yearBuilt).toBe("1985");
    expect(answerCustomerQuestion).not.toHaveBeenCalled();
  });

  it("ohne KI-Antwort (kein Key/Fehler) bleibt es beim bisherigen Standardtext – aber die Frage wird nicht als Angabe gespeichert", async () => {
    const turn = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Welche Leistungen bieten Sie an?", source: "widget", channel: "website" });
    expect(turn.replies.length).toBeGreaterThan(0);
    // Nur als Anliegen-Beschreibung festgehalten, nicht als Antwort auf eine Frage (Name, Adresse …).
    const { description, ...answers } = turn.fields;
    expect(description).toBe("Welche Leistungen bieten Sie an?");
    expect(Object.values(answers)).not.toContain("Welche Leistungen bieten Sie an?");
  });
});
