import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStore } from "@/lib/data/memory";
import type { Store } from "@/lib/data/store";
import { verifyFilledTemplate } from "@/lib/ai/verify-filled-template";
import { extractPdfText } from "@/lib/documents/pdf-text";
import { saveFile } from "@/lib/documents/storage";
import { matchServiceMaterials, receiveFilledTemplate, refreshCase, syncServiceQuestionOptions } from "./case-ops";

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

    // Grundriss/Energieausweis für diese Leistung bewusst abgeschaltet, damit die zurückgeschickte Vorlage
    // wirklich die letzte offene Pflichtangabe ist (sonst bliebe der Fall trotz korrekter PDF unvollständig).
    await store.saveServiceMessage({ service: "Energieberatung", body: "Danke!", appointmentNote: "Vielen Dank, ein Mitarbeiter meldet sich in Kürze bei Ihnen.", requiresFloorplan: false, requiresEnergyCertificate: false });
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

  it("bucht nach der letzten fehlenden PDF automatisch einen Termin, aber nur wenn der Fall dadurch WIRKLICH komplett ist (keine sonstigen Dokumente mehr offen)", async () => {
    vi.mocked(extractPdfText).mockResolvedValueOnce("Förderantrag ausgefüllt - Name: Max Mustermann");
    vi.mocked(verifyFilledTemplate).mockResolvedValueOnce({ filled: true, wrongDocument: false, note: "" });

    // Fördermittelberatung verlangt standardmäßig weder Grundriss noch Energieausweis – die Vorlage ist
    // also wirklich der letzte offene Punkt.
    const template = await store.saveDocumentTemplate({ service: "Fördermittelberatung", title: "Förderantrag", fileName: "antrag.pdf", storagePath: "demo/foerder.pdf" });
    const c = await store.createCase({
      source: "email",
      status: "QUALIFYING",
      assignedTo: null,
      summary: "",
      fields: { service: "Fördermittelberatung", email: "kunde@example.com", name: "Max Mustermann" },
      customerName: "Max Mustermann",
      service: "Fördermittelberatung",
    });
    await store.saveTemplateDocument({ caseId: c.id, templateId: template.id, status: "sent", storagePath: "", aiNote: "", receivedAt: null });

    const ok = await receiveFilledTemplate(store, c.id, new Uint8Array([1, 2, 3]), "antrag_ausgefuellt.pdf");
    expect(ok).toBe(true);

    const updated = await store.getCase(c.id);
    expect(updated?.status).toBe("READY_FOR_REVIEW");
    const appointments = await store.listAppointments();
    expect(appointments.some((a) => a.caseId === c.id && a.status === "proposed")).toBe(true);

    const messages = await store.listMessages(c.id);
    const text = messages.find((m) => m.role === "assistant")?.content ?? "";
    expect(text).toMatch(/Mitarbeiter/);
  });

  it("übernimmt nur die vom Kunden neu eingetragenen Angaben aus der Vorlage, nicht den Vordruck-Text", async () => {
    const blankPath = await saveFile({ companyId: "demo", caseId: "demo", bytes: new Uint8Array([1]), mime: "application/pdf" });
    vi.mocked(extractPdfText)
      .mockResolvedValueOnce("Vollmacht Energieberatung\nName: Max Mustermann\nBaujahr: 1998\nUnterschrift: Max Mustermann") // ausgefüllte Vorlage
      .mockResolvedValueOnce("Vollmacht Energieberatung\nName: ______\nBaujahr: ______\nUnterschrift: ______"); // leere Vorlage
    vi.mocked(verifyFilledTemplate).mockResolvedValueOnce({ filled: true, wrongDocument: false, note: "" });

    const template = await store.saveDocumentTemplate({ service: "Energieberatung", title: "Vollmacht", fileName: "vollmacht.pdf", storagePath: blankPath });
    const fields = { service: "Energieberatung", email: "kunde@example.com", name: "Falscher Name" };
    const c = await store.createCase({ source: "email", status: "QUALIFYING", assignedTo: null, summary: "", fields, customerName: "Falscher Name", service: "Energieberatung" });
    await store.saveTemplateDocument({ caseId: c.id, templateId: template.id, status: "sent", storagePath: "", aiNote: "", receivedAt: null });

    const ok = await receiveFilledTemplate(store, c.id, new Uint8Array([1, 2, 3]), "vollmacht_ausgefuellt.pdf");
    expect(ok).toBe(true);

    const updated = await store.getCase(c.id);
    // Baujahr stand nicht im Chat, aber neu in der ausgefüllten Vorlage -> wird übernommen.
    expect(updated?.fields.yearBuilt).toBe("1998");
    // "name" war bereits beantwortet (Chat) -> die Vorlage darf das nicht überschreiben.
    expect(updated?.fields.name).toBe("Falscher Name");
  });
});

describe("refreshCase – Frage-Flow ist eine reine Website-Chat-Funktion", () => {
  it("E-Mail-Fälle werden nicht durch offene Frage-Flow-Pflichtfelder (Name, Baujahr …) blockiert", async () => {
    const store = freshStore();
    const c = await store.createCase({
      source: "email",
      status: "QUALIFYING",
      assignedTo: null,
      summary: "",
      fields: { service: "Energieberatung", email: "kunde@example.com" },
      customerName: "Unbekannt",
      service: "Energieberatung",
    });
    const { checklist } = await refreshCase(store, c.id, { hint: "chat" });
    expect(checklist.dataComplete).toBe(true);
  });

  it("Website-Chat-Fälle bleiben weiterhin unvollständig, solange Pflichtfelder fehlen", async () => {
    const store = freshStore();
    const c = await store.createCase({
      source: "widget",
      status: "QUALIFYING",
      assignedTo: null,
      summary: "",
      fields: { service: "Energieberatung" },
      customerName: "Unbekannt",
      service: "Energieberatung",
    });
    const { checklist } = await refreshCase(store, c.id, { hint: "chat" });
    expect(checklist.dataComplete).toBe(false);
  });
});

describe("receiveFilledTemplate – mehrere gleichzeitig offene Vorlagen", () => {
  it("ordnet jedes zurückgeschickte Dokument anhand des Dateinamens der richtigen erwarteten Vorlage zu, statt blind die erste offene zu nehmen (Regressionstest)", async () => {
    const store = freshStore();
    vi.mocked(extractPdfText).mockResolvedValue("beliebiger Text");
    vi.mocked(verifyFilledTemplate).mockResolvedValue({ filled: true, wrongDocument: false, note: "" });

    // Leistungs-Vorlage zuerst angelegt, "bei jeder Anfrage dabei"-Vorlage danach – die Reihenfolge, in der
    // die alte Logik blind die "erste offene" Vorlage gegriffen hätte.
    const isfpTemplate = await store.saveDocumentTemplate({ service: "iSFP", title: "Vollmacht iSFP", fileName: "Vollmacht iSFP.pdf", storagePath: "demo/x.pdf" });
    const alwaysTemplate = await store.saveDocumentTemplate({ service: "", title: "Datenerfassungsblatt Neu", fileName: "Datenerfassungsblatt Neu.pdf", storagePath: "demo/y.pdf", alwaysInclude: true });
    const c = await store.createCase({ source: "email", status: "NEW", assignedTo: null, summary: "", fields: { service: "iSFP", email: "kunde@test.de" }, customerName: "Max", service: "iSFP" });
    await store.saveTemplateDocument({ caseId: c.id, templateId: isfpTemplate.id, status: "sent", storagePath: "", aiNote: "", receivedAt: null });
    await store.saveTemplateDocument({ caseId: c.id, templateId: alwaysTemplate.id, status: "sent", storagePath: "", aiNote: "", receivedAt: null });

    // Kunde schickt zuerst die "immer dabei"-Vorlage zurück, danach die Leistungs-Vorlage (bewusst in der
    // Reihenfolge, die die alte "erste offene nehmen"-Logik durcheinanderbringen würde).
    await receiveFilledTemplate(store, c.id, new Uint8Array([1]), "Datenerfassungsblatt Neu.pdf");
    await receiveFilledTemplate(store, c.id, new Uint8Array([2]), "Vollmacht iSFP (1).pdf");

    const titlesChecked = vi.mocked(verifyFilledTemplate).mock.calls.map(([title]) => title);
    expect(titlesChecked).toEqual(["Datenerfassungsblatt Neu", "Vollmacht iSFP"]);

    const docs = await store.listTemplateDocuments(c.id);
    expect(docs.find((d) => d.templateId === isfpTemplate.id)?.status).toBe("received");
    expect(docs.find((d) => d.templateId === alwaysTemplate.id)?.status).toBe("received");
  });
});

describe("matchServiceMaterials", () => {
  it("überspringt eine Vorlage, deren Datei nicht aus dem Speicher geladen werden kann, markiert sie NICHT als gesendet, schickt andere passende Vorlagen aber trotzdem (Regressionstest)", async () => {
    const store = freshStore();
    const goodPath = await saveFile({ companyId: "demo", caseId: "demo", bytes: new Uint8Array([1, 2, 3]), mime: "application/pdf" });
    const broken = await store.saveDocumentTemplate({ service: "iSFP", title: "iSFP-Vollmacht", fileName: "isfp.pdf", storagePath: "pfad/der/nie/gespeichert/wurde.pdf" });
    const always = await store.saveDocumentTemplate({ service: "", title: "Datenschutz", fileName: "datenschutz.pdf", storagePath: goodPath, alwaysInclude: true });
    const c = await store.createCase({ source: "email", status: "NEW", assignedTo: null, summary: "", fields: { service: "iSFP" }, customerName: "Max", service: "iSFP" });

    const result = await matchServiceMaterials(store, c, await store.listDocumentTemplates(), [], "email");
    expect(result).not.toBeNull();
    expect(result!.attachments).toHaveLength(1);
    expect(result!.attachments[0].filename).toBe("datenschutz.pdf");

    const docs = await store.listTemplateDocuments(c.id);
    expect(docs.some((d) => d.templateId === always.id && d.status === "sent")).toBe(true);
    // Nicht als gesendet markiert, obwohl in diesem Zug "pending" -> wird beim nächsten Mal erneut versucht.
    expect(docs.some((d) => d.templateId === broken.id)).toBe(false);

    const events = await store.listEvents(c.id);
    expect(events.some((e) => e.text.includes("konnte nicht aus dem Speicher geladen werden"))).toBe(true);
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
