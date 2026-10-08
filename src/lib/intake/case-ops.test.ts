import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStore } from "@/lib/data/memory";
import type { Store } from "@/lib/data/store";
import { verifyFilledTemplate } from "@/lib/ai/verify-filled-template";
import { extractPdfText } from "@/lib/documents/pdf-text";
import { receiveFilledTemplate, syncServiceQuestionOptions } from "./case-ops";

// Ohne AI_API_KEY faellt verifyFilledTemplate immer auf {filled: null} zurueck - fuer den "nicht ausgefuellt"-Pfad
// wird hier deterministisch gemockt, statt einen echten KI-Key fuer den Test zu brauchen.
vi.mock("@/lib/documents/pdf-text", () => ({ extractPdfText: vi.fn(async () => "") }));
vi.mock("@/lib/ai/verify-filled-template", () => ({ verifyFilledTemplate: vi.fn(async () => ({ filled: null, wrongDocument: false, note: "" })) }));

function freshStore(): Store {
  delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
  return createMemoryStore();
}

describe("receiveFilledTemplate", () => {
  let store: Store;
  beforeEach(() => {
    store = freshStore();
  });

  it("ohne ausstehende Vorlage: tut nichts und gibt false zurück", async () => {
    const c = await store.createCase({ source: "widget", status: "NEW", assignedTo: null, summary: "", fields: {}, customerName: "Max", service: "" });
    const ok = await receiveFilledTemplate(store, c.id, new Uint8Array([1, 2, 3]), "test.pdf");
    expect(ok).toBe(false);
  });

  it("markiert eine ausstehende Vorlage als erhalten, sobald der Anhang eintrifft", async () => {
    const template = await store.saveDocumentTemplate({ service: "Energieberatung", title: "Vollmacht", fileName: "vollmacht.pdf", storagePath: "demo/x.pdf" });
    const c = await store.createCase({ source: "email", status: "NEW", assignedTo: null, summary: "", fields: { service: "Energieberatung" }, customerName: "Max", service: "Energieberatung" });
    await store.saveTemplateDocument({ caseId: c.id, templateId: template.id, status: "sent", storagePath: "", aiNote: "", receivedAt: null });

    const ok = await receiveFilledTemplate(store, c.id, new Uint8Array([1, 2, 3]), "vollmacht_ausgefuellt.pdf");
    expect(ok).toBe(true);

    const [doc] = await store.listTemplateDocuments(c.id);
    expect(doc.status).toBe("received");
    expect(doc.storagePath).not.toBe("");

    const events = await store.listEvents(c.id);
    expect(events.some((e) => e.type === "document" && e.text.includes("per E-Mail zurückerhalten"))).toBe(true);
  });

  it("erkennt eine nicht ausgefüllte Vorlage, zählt sie nicht als erledigt und bittet automatisch um eine neue", async () => {
    vi.mocked(extractPdfText).mockResolvedValueOnce("Formular Name: ______ Datum: ______");
    vi.mocked(verifyFilledTemplate).mockResolvedValueOnce({ filled: false, wrongDocument: false, note: "Das Datum fehlt." });

    const template = await store.saveDocumentTemplate({ service: "Energieberatung", title: "Vollmacht", fileName: "vollmacht.pdf", storagePath: "demo/x.pdf" });
    const c = await store.createCase({ source: "email", status: "NEW", assignedTo: null, summary: "", fields: { service: "Energieberatung", email: "kunde@example.com" }, customerName: "Max", service: "Energieberatung" });
    await store.saveTemplateDocument({ caseId: c.id, templateId: template.id, status: "sent", storagePath: "", aiNote: "", receivedAt: null });

    const ok = await receiveFilledTemplate(store, c.id, new Uint8Array([1, 2, 3]), "vollmacht_leer.pdf");
    expect(ok).toBe(true);

    const [doc] = await store.listTemplateDocuments(c.id);
    expect(doc.status).toBe("received");
    expect(doc.filled).toBe(false);

    const messages = await store.listMessages(c.id);
    const requestText = messages.find((m) => m.role === "assistant")?.content ?? "";
    expect(requestText).toContain("Das Datum fehlt");
    expect(requestText).toContain("erneut");
  });

  it("erkennt eine falsche Vorlage (anderes Formular geschickt) und bittet um die richtige", async () => {
    vi.mocked(extractPdfText).mockResolvedValueOnce("Vollmacht für Einzelmaßnahmen - Name: Max Beispiel");
    vi.mocked(verifyFilledTemplate).mockResolvedValueOnce({
      filled: true,
      wrongDocument: true,
      note: "Das scheint die Vollmacht für Einzelmaßnahmen zu sein, nicht die erwartete iSFP-Vorlage.",
    });

    const template = await store.saveDocumentTemplate({ service: "iSFP", title: "iSFP-Vollmacht", fileName: "isfp.pdf", storagePath: "demo/isfp.pdf" });
    const c = await store.createCase({ source: "email", status: "NEW", assignedTo: null, summary: "", fields: { service: "iSFP", email: "kunde@example.com" }, customerName: "Max", service: "iSFP" });
    await store.saveTemplateDocument({ caseId: c.id, templateId: template.id, status: "sent", storagePath: "", aiNote: "", receivedAt: null });

    const ok = await receiveFilledTemplate(store, c.id, new Uint8Array([1, 2, 3]), "em_vollmacht.pdf");
    expect(ok).toBe(true);

    const [doc] = await store.listTemplateDocuments(c.id);
    expect(doc.status).toBe("received");
    expect(doc.filled).toBe(false); // falsches Dokument zaehlt nicht als erledigt, auch wenn es selbst ausgefuellt war

    const messages = await store.listMessages(c.id);
    const requestText = messages.find((m) => m.role === "assistant")?.content ?? "";
    expect(requestText).toContain("Einzelmaßnahmen");
    expect(requestText).toContain("iSFP-Vollmacht");
  });

  it("schickt die Abschluss-Nachricht, wenn die PDF die letzte fehlende Angabe war", async () => {
    vi.mocked(extractPdfText).mockResolvedValueOnce("Vollmacht Energieberatung - Name: Max Mustermann, Datum: 03.10.2026, Unterschrift: Max Mustermann");
    vi.mocked(verifyFilledTemplate).mockResolvedValueOnce({ filled: true, wrongDocument: false, note: "" });

    await store.saveServiceMessage({ service: "Energieberatung", body: "Danke!", appointmentNote: "Vielen Dank, ein Mitarbeiter meldet sich in Kürze bei Ihnen." });
    const template = await store.saveDocumentTemplate({ service: "Energieberatung", title: "Vollmacht", fileName: "vollmacht.pdf", storagePath: "demo/x.pdf" });
    const fields = {
      service: "Energieberatung",
      buildingType: "Einfamilienhaus",
      yearBuilt: "1998",
      livingArea: "140",
      heating: "Gas",
      ownerStatus: "Eigentümer",
      street: "Musterstraße 1",
      postalCode: "80331",
      name: "Max Mustermann",
      email: "kunde@example.com",
      phone: "+49 170 1234567",
    };
    const c = await store.createCase({ source: "email", status: "QUALIFYING", assignedTo: null, summary: "", fields, customerName: "Max Mustermann", service: "Energieberatung" });
    await store.saveTemplateDocument({ caseId: c.id, templateId: template.id, status: "sent", storagePath: "", aiNote: "", receivedAt: null });

    const ok = await receiveFilledTemplate(store, c.id, new Uint8Array([1, 2, 3]), "vollmacht_ausgefuellt.pdf");
    expect(ok).toBe(true);

    const messages = await store.listMessages(c.id);
    const completionText = messages.find((m) => m.role === "assistant")?.content ?? "";
    expect(completionText).toContain("meldet sich in Kürze");

    const updated = await store.getCase(c.id);
    expect(["COMPLETE", "READY_FOR_REVIEW"]).toContain(updated?.status);
  });
});

describe("syncServiceQuestionOptions", () => {
  let store: Store;
  beforeEach(() => {
    store = freshStore();
  });

  it("grenzt die Auswahl der 'Leistung'-Frage auf die angebotenen Leistungen ein (plus 'Sonstiges')", async () => {
    await syncServiceQuestionOptions(store, ["Energieberatung", "iSFP"]);
    const question = (await store.listQuestions()).find((q) => q.key === "service");
    expect(question?.options).toEqual(["Energieberatung", "iSFP", "Sonstiges"]);
  });

  it("dupliziert 'Sonstiges' nicht, wenn es schon in den angebotenen Leistungen steht", async () => {
    await syncServiceQuestionOptions(store, ["Energieberatung", "Sonstiges"]);
    const question = (await store.listQuestions()).find((q) => q.key === "service");
    expect(question?.options).toEqual(["Energieberatung", "Sonstiges"]);
  });
});
