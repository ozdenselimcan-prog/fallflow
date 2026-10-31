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

describe("E-Mail: kein doppelter Anhang-Hinweis", () => {
  it("erwähnt das Büro den Anhang selbst, hängt FallFlow keinen zweiten Hinweis an", async () => {
    const store = freshStore();
    const { saveFile } = await import("@/lib/documents/storage");
    const path = await saveFile({ companyId: "demo", caseId: "demo", bytes: new TextEncoder().encode("%PDF-1.4\n"), mime: "application/pdf" });
    await store.saveDocumentTemplate({ service: "iSFP", title: "Datenerfassung", fileName: "daten.pdf", storagePath: path });
    await store.saveServiceMessage({ service: "iSFP", body: "Vielen Dank! Anbei unser Datenerfassungsblatt.", appointmentNote: "", requiresFloorplan: false, requiresEnergyCertificate: false });
    const turn = await email(store, "Hallo, wir möchten einen iSFP für unser Haus.");
    expect(turn.replies[0]).not.toContain("Im Anhang finden Sie");
    expect(turn.replies[0]).toContain("Bitte senden Sie die ausgefüllten Unterlagen einfach als Antwort auf diese E-Mail zurück.");

    const store2 = freshStore();
    const path2 = await saveFile({ companyId: "demo", caseId: "demo", bytes: new TextEncoder().encode("%PDF-1.4\n"), mime: "application/pdf" });
    await store2.saveDocumentTemplate({ service: "iSFP", title: "Datenerfassung", fileName: "daten.pdf", storagePath: path2 });
    await store2.saveServiceMessage({ service: "iSFP", body: "Anbei unser Formular – bitte ausgefüllt zurückschicken.", appointmentNote: "", requiresFloorplan: false, requiresEnergyCertificate: false });
    const turn2 = await email(store2, "Hallo, wir möchten einen iSFP für unser Haus.");
    expect(turn2.replies[0]).toBe("Anbei unser Formular – bitte ausgefüllt zurückschicken.");
  });
});

describe("Nur-Info-PDFs und Status 'Antwort durch Büro nötig'", () => {
  it("eine Nur-Info-PDF wird mitgeschickt, aber nicht zurückerwartet", async () => {
    const store = freshStore();
    const { saveFile } = await import("@/lib/documents/storage");
    const path = await saveFile({ companyId: "demo", caseId: "demo", bytes: new TextEncoder().encode("%PDF-1.4\n"), mime: "application/pdf" });
    await store.saveDocumentTemplate({ service: "Fördermittelberatung", title: "Preisliste", fileName: "preise.pdf", storagePath: path, requiresReturn: false });
    await store.saveServiceMessage({ service: "Fördermittelberatung", body: "Danke für Ihre Anfrage.", appointmentNote: "", requiresFloorplan: false, requiresEnergyCertificate: false });
    const turn = await email(store, "Hallo, ich möchte eine Fördermittelberatung für mein Haus.");
    expect(turn.replies[0]).toContain("Zu Ihrer Information finden Sie außerdem im Anhang: „Preisliste“");
    expect(turn.replies[0]).not.toContain("bitte ausfüllen");
    const [td] = await store.listTemplateDocuments(turn.sessionId);
    expect(td.status).toBe("info");
    // Die Preisliste blockiert den Fall nicht.
    expect((await store.getCase(turn.sessionId))?.status).toBe("READY_FOR_REVIEW");
  });

  it("Frage des Kunden → Status 'Antwort durch Büro nötig'", async () => {
    const store = freshStore();
    const turn = await email(store, "Hallo, ich interessiere mich für einen iSFP. Wie lange dauert das?");
    expect((await store.getCase(turn.sessionId))?.status).toBe("NEEDS_REPLY");
  });
});

describe("Fragen, die die Standard-Antwort beantwortet", () => {
  it("'Welche Angaben benötigen Sie noch von mir?' → normale Antwort mit Nachricht und Vorlage, keine Aufmerksamkeit", async () => {
    const store = freshStore();
    await store.saveServiceMessage({ service: "iSFP", body: "Vielen Dank für Ihre iSFP-Anfrage.", appointmentNote: "", requiresFloorplan: true, requiresEnergyCertificate: false });
    const turn = await email(store, "Hallo wollte einen individuellensanierungsfahrplan machen. Hier meine\nNummer 015203071089. Welche Angaben benötigen sie noch von mir?");
    expect((await store.getCase(turn.sessionId))?.fields.needsAttention ?? "").toBe("");
    expect(turn.replies[0]).toContain("Vielen Dank für Ihre iSFP-Anfrage.");
    expect(turn.replies[0]).toContain("Grundriss");
  });

  it("eine echte Frage daneben bleibt eine Frage", async () => {
    const { obviousHumanQuestion, withoutProcessQuestions } = await import("@/lib/ai/personal-reply");
    expect(withoutProcessQuestions("Welche Unterlagen brauchen Sie? Was kostet das?")).toBe("Was kostet das?");
    // Betreff ("iSFP") und Frage bleiben getrennt.
    expect(obviousHumanQuestion(withoutProcessQuestions("iSFP\n\nWas kostet ein iSFP?"))).toBe("Was kostet ein iSFP?");
    expect(withoutProcessQuestions("Was muss ich Ihnen schicken? Wie geht es weiter?")).toBe("");
    expect(withoutProcessQuestions("Welche Unterlagen brauchen Sie und was kostet das ungefähr?")).toBe("was kostet das ungefähr?");
    expect(withoutProcessQuestions("Was muss ich Ihnen alles schicken und wie geht es dann weiter?")).toBe("");
  });
});

describe("Preis-, Dauer- und Förderfragen gehen immer ans Büro", () => {
  it.each([
    ["Hallo, ich möchte einen iSFP. Was kostet das?", true],
    ["Ich brauche einen Energieausweis. Wie lange dauert das bei Ihnen?", true],
    ["Bekomme ich dafür eine Förderung?", true],
    ["Hallo, ich hätte gern eine Heizlastberechnung für unser Haus.", false],
    ["Hallo, ich möchte einen iSFP. Welche Angaben benötigen Sie noch?", false],
  ])("%s → %s", async (text, expected) => {
    const { obviousHumanQuestion, withoutProcessQuestions } = await import("@/lib/ai/personal-reply");
    expect(Boolean(obviousHumanQuestion(withoutProcessQuestions(text)))).toBe(expected);
  });
});

describe("Rücksende-Hinweis bei anderer Wortstellung", () => {
  it("'… schicken es uns zurück' wird erkannt – kein doppelter Hinweis", async () => {
    const store = freshStore();
    const { saveFile } = await import("@/lib/documents/storage");
    const path = await saveFile({ companyId: "demo", caseId: "demo", bytes: new TextEncoder().encode("%PDF-1.4\n"), mime: "application/pdf" });
    await store.saveDocumentTemplate({ service: "iSFP", title: "Datenerfassung", fileName: "daten.pdf", storagePath: path });
    await store.saveServiceMessage({ service: "iSFP", body: "Anbei unser Datenerfassungsblatt – bitte füllen Sie es aus und schicken es uns zurück.", appointmentNote: "", requiresFloorplan: false, requiresEnergyCertificate: false });
    const turn = await email(store, "Hallo, wir möchten einen iSFP für unser Haus.");
    expect(turn.replies[0]).not.toContain("Bitte senden Sie die ausgefüllten Unterlagen");
  });
});
