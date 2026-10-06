import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@/lib/data/memory";
import type { Store } from "@/lib/data/store";
import { receiveFilledTemplate } from "./case-ops";

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
});
