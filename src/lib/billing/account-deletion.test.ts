import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createMemoryStore } from "@/lib/data/memory";
import { saveFile } from "@/lib/documents/storage";
import { registerUpload } from "@/lib/intake/case-ops";
import { deletionDate, retentionAction } from "./account-deletion";
import { buildCompanyExport } from "./export";

const day = 86_400_000;
const canceled = (daysAgo: number, warned = false) => ({
  companyId: "c1",
  canceledAt: new Date(Date.now() - daysAgo * day).toISOString(),
  warnedAt: warned ? new Date().toISOString() : null,
});

describe("Löschung nach Vertragsende", () => {
  it("Löschtermin = Vertragsende + 30 Tage", () => {
    expect(deletionDate("2026-10-01T00:00:00.000Z")?.toISOString()).toBe("2026-10-31T00:00:00.000Z");
    expect(deletionDate(null)).toBeNull();
  });

  it.each([
    [5, false, null],
    [23.5, false, "warn"],
    [25, true, null],
    [30.1, true, "delete"],
    [45, false, "delete"],
  ] as const)("%s Tage nach Vertragsende (gewarnt: %s) → %s", (daysAgo, warned, expected) => {
    expect(retentionAction(canceled(daysAgo, warned))).toBe(expected);
  });

  it("ohne Vertragsende passiert nichts", () => {
    expect(retentionAction({ companyId: "c1", canceledAt: null, warnedAt: null })).toBeNull();
  });
});

describe("Datenexport", () => {
  it("enthält Fallübersicht, Fallakten mit Dokumenten und Termine", async () => {
    delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
    const store = createMemoryStore();
    const c = await store.createCase({ source: "email", status: "QUALIFYING", assignedTo: null, summary: "Kurz", fields: { name: "Erika Beispiel", service: "iSFP", email: "erika@beispiel.de" }, customerName: "Erika Beispiel", service: "iSFP" });
    await store.addMessage(c.id, "user", "Hallo, ich möchte einen iSFP.", { channel: "email", delivery: "delivered" });
    const path = await saveFile({ companyId: c.companyId, caseId: c.id, bytes: new TextEncoder().encode("%PDF-1.4 test"), mime: "application/pdf" });
    await registerUpload(store, c, { kind: "floorplan", fileName: "Grundriss EG.pdf", mimeType: "application/pdf", size: 13, storagePath: path });

    const files = unzipSync(await buildCompanyExport(store));
    const names = Object.keys(files);
    expect(names).toContain("faelle.csv");
    expect(names).toContain("termine.csv");
    expect(strFromU8(files["faelle.csv"])).toContain("Erika Beispiel");
    const akte = names.find((n) => n.includes(c.id.slice(0, 8)) && n.endsWith("fallakte.txt"))!;
    expect(strFromU8(files[akte])).toContain("Hallo, ich möchte einen iSFP.");
    expect(names.some((n) => n.includes(c.id.slice(0, 8)) && n.endsWith("Grundriss_EG.pdf"))).toBe(true);
  });
});
