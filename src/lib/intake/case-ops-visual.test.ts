import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inspectFilledPdf } from "@/lib/ai/inspect-filled-pdf";
import { verifyFilledTemplate } from "@/lib/ai/verify-filled-template";
import { createMemoryStore } from "@/lib/data/memory";
import type { Store } from "@/lib/data/store";
import { extractPdfText } from "@/lib/documents/pdf-text";
import { saveFile } from "@/lib/documents/storage";
import { receiveFilledTemplate } from "./case-ops";

vi.mock("@/lib/documents/pdf-text", () => ({ extractPdfText: vi.fn(async () => "") }));
vi.mock("@/lib/ai/verify-filled-template", () => ({ verifyFilledTemplate: vi.fn(async () => ({ filled: null, wrongDocument: false, note: "" })) }));
vi.mock("@/lib/ai/inspect-filled-pdf", () => ({ inspectFilledPdf: vi.fn(async () => null) }));

function freshStore(): Store {
  delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
  return createMemoryStore();
}

async function setup(store: Store) {
  const path = await saveFile({ companyId: "demo", caseId: "demo", bytes: new Uint8Array([1]), mime: "application/pdf" });
  const template = await store.saveDocumentTemplate({ service: "iSFP", title: "Datenerfassungsblatt", fileName: "daten.pdf", storagePath: path });
  const c = await store.createCase({ source: "email", status: "WAITING_FOR_CUSTOMER", assignedTo: null, summary: "", fields: { service: "iSFP", email: "kunde@example.com", name: "Edu Hartmann" }, customerName: "Edu Hartmann", service: "iSFP" });
  await store.saveTemplateDocument({ caseId: c.id, templateId: template.id, status: "sent", storagePath: "", aiNote: "", receivedAt: null });
  return c;
}

describe("Zurückgeschicktes Formular ohne auslesbaren Text (Scan, Foto, Handschrift)", () => {
  let store: Store;
  beforeEach(() => {
    store = freshStore();
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.mocked(extractPdfText).mockResolvedValue("Datenerfassungsblatt\nName: ____\nWohnfläche: ____ m2");
    vi.mocked(verifyFilledTemplate).mockResolvedValue({ filled: false, wrongDocument: false, note: "Die Felder sind leer." });
    vi.mocked(inspectFilledPdf).mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("die KI sieht sich die Seiten an, erkennt die Handschrift und übernimmt die Angaben – keine falsche Beanstandung", async () => {
    vi.mocked(inspectFilledPdf).mockResolvedValue({
      filled: true,
      wrongDocument: false,
      note: "",
      extraction: { fields: { livingArea: "150", yearBuilt: "1999" }, entries: [{ label: "Vermietung", value: "Ja" }] },
    });
    const c = await setup(store);
    await receiveFilledTemplate(store, c.id, new Uint8Array([1, 2, 3]), "scan.pdf");
    const updated = await store.getCase(c.id);
    expect(updated?.fields.livingArea).toBe("150");
    expect(updated?.fields.formEntries).toContain("Vermietung: Ja");
    expect((await store.listMessages(c.id)).some((m) => m.content.includes("nicht vollständig") || m.content.includes("aufgefallen"))).toBe(false);
    const [td] = await store.listTemplateDocuments(c.id);
    expect(td.filled).toBe(true);
  });

  it("klappt die Sichtprüfung nicht, bekommt der Kunde KEINE Beanstandung – das Büro prüft selbst", async () => {
    vi.mocked(inspectFilledPdf).mockResolvedValue(null);
    const c = await setup(store);
    await receiveFilledTemplate(store, c.id, new Uint8Array([1, 2, 3]), "scan.pdf");
    const updated = await store.getCase(c.id);
    expect(updated?.fields.needsAttention).toMatch(/Formular „Datenerfassungsblatt“ bitte selbst prüfen/);
    expect(updated?.status).toBe("NEEDS_REPLY");
    expect((await store.listMessages(c.id)).filter((m) => m.role === "assistant")).toEqual([]);
  });

  it("bestätigt auch die Sichtprüfung ein leeres Formular, wird der Kunde gebeten, es auszufüllen", async () => {
    vi.mocked(inspectFilledPdf).mockResolvedValue({ filled: false, wrongDocument: false, note: "Name und Wohnfläche sind leer.", extraction: { fields: {}, entries: [] } });
    const c = await setup(store);
    await receiveFilledTemplate(store, c.id, new Uint8Array([1, 2, 3]), "leer.pdf");
    const msg = (await store.listMessages(c.id)).find((m) => m.role === "assistant")?.content ?? "";
    expect(msg).toContain("Name und Wohnfläche sind leer.");
  });
});
