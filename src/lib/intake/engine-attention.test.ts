import { beforeEach, describe, expect, it } from "vitest";
import { heuristicQuestion, stripQuoted } from "@/lib/ai/personal-reply";
import { createMemoryStore } from "@/lib/data/memory";
import type { Store } from "@/lib/data/store";
import { receiveEmailAttachments } from "./case-ops";
import { processIntakeMessage } from "./engine";

function freshStore(): Store {
  delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
  return createMemoryStore();
}

const email = (store: Store, text: string, sessionId: string | null = null) =>
  processIntakeMessage(store, { companyId: "demo", sessionId, text, source: "email", channel: "email", identity: { email: "kunde@example.com" } });

describe("E-Mail: Aufmerksamkeit benötigt (keine automatische Antwort)", () => {
  let store: Store;
  beforeEach(async () => {
    store = freshStore();
    await store.saveServiceMessage({ service: "iSFP", body: "Vielen Dank für Ihre iSFP-Anfrage. Bitte schicken Sie uns Ihren Grundriss.", appointmentNote: "", requiresFloorplan: true, requiresEnergyCertificate: false });
  });

  it("Leistung nicht erkannt: keine Antwort an den Kunden, Fall markiert", async () => {
    const turn = await email(store, "Guten Tag, ich habe ein Anliegen zu meinem Haus und würde mich über eine Rückmeldung freuen.");
    expect(turn.replies).toEqual([]);
    const c = await store.getCase(turn.sessionId);
    expect(c?.fields.needsAttention).toBe("Leistung nicht erkannt");
    expect((await store.listMessages(turn.sessionId)).filter((m) => m.role === "assistant")).toEqual([]);
  });

  it("Kunde stellt eine Frage: keine Leistungs-Nachricht, der Energieberater antwortet selbst", async () => {
    const turn = await email(store, "Hallo, ich interessiere mich für einen iSFP. Wie lange dauert so etwas bei Ihnen ungefähr?");
    expect(turn.replies).toEqual([]);
    const c = await store.getCase(turn.sessionId);
    expect(c?.fields.needsAttention).toMatch(/^Frage des Kunden: Wie lange dauert/);
  });

  it("normale Anfrage ohne Frage: KI antwortet wie gewohnt mit der Leistungs-Nachricht", async () => {
    const turn = await email(store, "Hallo, ich möchte einen individuellen Sanierungsfahrplan für mein Einfamilienhaus.");
    expect(turn.replies.join(" ")).toContain("iSFP-Anfrage");
    expect((await store.getCase(turn.sessionId))?.fields.needsAttention ?? "").toBe("");
  });

  it("nachgeschickte Unterlagen eines markierten Falls werden abgelegt, aber nicht automatisch beantwortet", async () => {
    const turn = await email(store, "Guten Tag, ich habe ein Anliegen zu meinem Haus.");
    const pdf = new TextEncoder().encode("%PDF-1.4\n%test\n");
    await receiveEmailAttachments(store, turn.sessionId, [{ filename: "grundriss.pdf", mime: "application/pdf", bytes: pdf }]);
    expect((await store.listDocuments(turn.sessionId)).some((d) => d.status === "received")).toBe(true);
    expect((await store.listMessages(turn.sessionId)).filter((m) => m.role === "assistant")).toEqual([]);
  });
});

describe("Frage-Erkennung ohne KI", () => {
  it.each([
    ["Was kostet ein iSFP bei Ihnen?", true],
    ["Können Sie mir helfen?", false],
    ["Ich möchte einen Energieausweis.", false],
    ["Anbei der Grundriss.\n\nAm 10.10.2026 schrieb Büro:\n> Haben Sie noch Fragen?", false],
  ])("%s → %s", (text, expected) => {
    expect(Boolean(heuristicQuestion(stripQuoted(text)))).toBe(expected);
  });
});
