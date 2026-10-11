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

  it("Rückrufwunsch: keine automatische Antwort", async () => {
    const turn = await email(store, "Ich brauche einen iSFP. Bitte rufen Sie mich an: 0151 999888.");
    expect(turn.replies).toEqual([]);
    expect((await store.getCase(turn.sessionId))?.fields.needsAttention).toBe("Kunde wünscht persönlichen Kontakt");
    // Keine Dokumente angefordert, solange der Energieberater selbst antworten soll.
    expect(await store.listDocuments(turn.sessionId)).toEqual([]);
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

describe("E-Mail: eine zusammenhängende Antwort je Leistung", () => {
  let store: Store;
  beforeEach(() => {
    store = freshStore();
  });

  it("PDF für jede Mail + eigene Nachricht ohne eigene PDF: die eigene Nachricht geht trotzdem raus (einmal)", async () => {
    const { saveFile } = await import("@/lib/documents/storage");
    const path = await saveFile({ companyId: "demo", caseId: "demo", bytes: new TextEncoder().encode("%PDF-1.4\n"), mime: "application/pdf" });
    await store.saveDocumentTemplate({ service: "", title: "Datenschutzhinweis", fileName: "datenschutz.pdf", storagePath: path, alwaysInclude: true });
    await store.saveServiceMessage({ service: "Energieausweis", body: "Danke für Ihre Energieausweis-Anfrage.", appointmentNote: "", requiresFloorplan: true, requiresEnergyCertificate: false });
    const turn = await email(store, "Guten Tag, ich benötige einen Energieausweis für mein Haus.");
    expect(turn.replies).toHaveLength(1);
    const text = turn.replies[0];
    expect(text.match(/Danke für Ihre Energieausweis-Anfrage/g)).toHaveLength(1);
    expect(text).toContain("„Datenschutzhinweis“");
    expect(text).toContain("Grundriss");
  });

  it("Anfrage ohne Fragezeichen/Fragesatz wird nie als Frage gewertet", async () => {
    const turn = await email(store, "Hallo, wir suchen eine Beratung zur energetischen Sanierung unseres Hauses.");
    expect((await store.getCase(turn.sessionId))?.fields.needsAttention ?? "").toBe("");
    expect(turn.replies).toHaveLength(1);
  });
});

describe("templateSimilarity", () => {
  it("erkennt die richtige Vorlage am Vordruck – unabhängig vom Büronamen", async () => {
    const { templateSimilarity } = await import("./case-ops");
    const blank = "Muster Energieberatung - Vollmacht BAFA\nName: ____\nStrasse: ____\nDatum: ____ Unterschrift: ____";
    const filled = "Muster Energieberatung - Vollmacht BAFA\nName: Max\nStrasse: Gartenweg 1\nDatum: 11.10.2026 Unterschrift: M.";
    const other = "Elektro Schmidt GmbH Rechnung Nr. 4711 Betrag 1.234,00 EUR";
    expect(templateSimilarity(blank, filled)).toBeGreaterThanOrEqual(0.9);
    expect(templateSimilarity(blank, other)).toBeLessThan(0.3);
  });
});
