import { describe, expect, it } from "vitest";
import type { CaseDocument, Question } from "@/lib/data/types";
import { buildChecklist, deriveStatus, documentRequirements, effectiveStatus, isRelevant, readinessOf, STALE_AFTER_MS } from "./checklist";

const q = (overrides: Partial<Question> & Pick<Question, "key" | "label">): Question => ({
  id: overrides.key,
  companyId: "c1",
  prompt: overrides.label,
  type: "text",
  options: [],
  required: true,
  active: true,
  position: 0,
  ...overrides,
});

describe("documentRequirements", () => {
  it("verlangt für normale Leistungen immer einen Grundriss", () => {
    const reqs = documentRequirements({ service: "Energieberatung" });
    expect(reqs.find((r) => r.kind === "floorplan")?.required).toBe(true);
  });

  it("verlangt Energieausweis nur bei den dafür vorgesehenen Leistungen", () => {
    expect(documentRequirements({ service: "iSFP" }).some((r) => r.kind === "energy_certificate")).toBe(true);
    expect(documentRequirements({ service: "Energieausweis" }).some((r) => r.kind === "energy_certificate")).toBe(false);
  });

  it("verlangt bei Fördermittelberatung standardmäßig weder Energieausweis noch Grundriss", () => {
    const reqs = documentRequirements({ service: "Fördermittelberatung" });
    expect(reqs.some((r) => r.kind === "energy_certificate")).toBe(false);
    expect(reqs.some((r) => r.kind === "floorplan")).toBe(false);
  });

  it("respektiert explizite Förder-Overrides", () => {
    const reqs = documentRequirements({ service: "Fördermittelberatung" }, { energyCertificate: true, floorplan: true });
    expect(reqs.find((r) => r.kind === "energy_certificate")?.required).toBe(true);
    expect(reqs.find((r) => r.kind === "floorplan")?.required).toBe(true);
  });

  it("Fotos sind nie Pflicht", () => {
    expect(documentRequirements({ service: "Energieberatung" }).find((r) => r.kind === "photos")?.required).toBe(false);
  });
});

describe("isRelevant", () => {
  it("fragt 'floors' nur bei Mehrfamilienhaus oder passender Leistung", () => {
    expect(isRelevant({ key: "floors" }, { buildingType: "Mehrfamilienhaus" })).toBe(true);
    expect(isRelevant({ key: "floors" }, { service: "Sanierung" })).toBe(true);
    expect(isRelevant({ key: "floors" }, { buildingType: "Einfamilienhaus", service: "Energieausweis" })).toBe(false);
  });

  it("alle anderen Fragen sind immer relevant", () => {
    expect(isRelevant({ key: "heating" }, {})).toBe(true);
  });
});

describe("buildChecklist", () => {
  const questions: Question[] = [
    q({ key: "service", label: "Leistung", position: 0 }),
    q({ key: "name", label: "Name", position: 1 }),
    q({ key: "notes", label: "Notizen", required: false, position: 2 }),
  ];

  it("zählt fehlende Pflichtfelder und -dokumente als 'missing'", () => {
    const checklist = buildChecklist({ questions, fields: { service: "Energieberatung" }, documents: [] });
    expect(checklist.missingFields.map((i) => i.key)).toEqual(["name"]);
    expect(checklist.missing.some((i) => i.key === "doc:floorplan")).toBe(true);
    expect(checklist.dataComplete).toBe(false);
  });

  it("dataComplete ignoriert fehlende Dokumente, nur Felder zählen", () => {
    const checklist = buildChecklist({ questions, fields: { service: "Energieberatung", name: "Max" }, documents: [] });
    expect(checklist.dataComplete).toBe(true);
    expect(checklist.missing.some((i) => i.key === "doc:floorplan")).toBe(true);
  });

  it("erkennt erhaltene vs. nur angeforderte Dokumente", () => {
    const documents: CaseDocument[] = [
      { id: "d1", caseId: "c1", companyId: "c1", kind: "floorplan", status: "requested", fileName: "", mimeType: "", size: 0, storagePath: "", requestedAt: "", receivedAt: null },
    ];
    const checklist = buildChecklist({ questions, fields: { service: "Energieausweis", name: "Max" }, documents });
    const floorplan = checklist.items.find((i) => i.key === "doc:floorplan")!;
    expect(floorplan.done).toBe(false);
    expect(floorplan.requested).toBe(true);
    expect(checklist.unrequestedDocuments.some((i) => i.key === "doc:floorplan")).toBe(false);
  });

  it("übersprungene (SKIPPED) Felder gelten nicht als beantwortet", () => {
    const checklist = buildChecklist({ questions, fields: { service: "Energieberatung", name: "—" }, documents: [] });
    expect(checklist.dataComplete).toBe(false);
  });

  it("inaktive Fragen fließen nicht in die Checkliste ein", () => {
    const withInactive = [...questions, q({ key: "phone", label: "Telefon", active: false, position: 3 })];
    const checklist = buildChecklist({ questions: withInactive, fields: { service: "Energieberatung", name: "Max" }, documents: [] });
    expect(checklist.items.some((i) => i.key === "phone")).toBe(false);
  });

  it("gibt Förder-Overrides an documentRequirements weiter", () => {
    const withOverride = buildChecklist({
      questions,
      fields: { service: "Fördermittelberatung", name: "Max" },
      documents: [],
      foerderOverrides: { energyCertificate: true, floorplan: false },
    });
    expect(withOverride.items.some((i) => i.key === "doc:energy_certificate")).toBe(true);
    expect(withOverride.items.some((i) => i.key === "doc:floorplan")).toBe(false);
  });

  it("gesendete Vorlagen zählen als fehlendes Pflichtdokument, bis sie zurück sind", () => {
    const sent = buildChecklist({
      questions,
      fields: { service: "Energieberatung", name: "Max" },
      documents: [],
      templateSends: [{ id: "t1", title: "Vollmacht", status: "sent" }],
    });
    expect(sent.items.some((i) => i.key === "template:t1" && !i.done)).toBe(true);
    expect(sent.missing.some((i) => i.key === "template:t1")).toBe(true);
    // Vorlagen gelten sofort als "angefordert" (das Buero hat sie ja schon geschickt) – tauchen nicht als unrequested auf.
    expect(sent.unrequestedDocuments.some((i) => i.key === "template:t1")).toBe(false);

    const received = buildChecklist({
      questions,
      fields: { service: "Energieberatung", name: "Max" },
      documents: [],
      templateSends: [{ id: "t1", title: "Vollmacht", status: "received" }],
    });
    expect(received.missing.some((i) => i.key === "template:t1")).toBe(false);
  });
});

describe("deriveStatus", () => {
  const baseChecklist = (dataComplete: boolean, docsReceived: boolean) =>
    buildChecklist({
      questions: [q({ key: "name", label: "Name" })],
      fields: dataComplete ? { name: "Max", service: "Energieausweis" } : { service: "Energieausweis" },
      documents: docsReceived
        ? [{ id: "d1", caseId: "c1", companyId: "c1", kind: "floorplan", status: "received", fileName: "", mimeType: "", size: 0, storagePath: "", requestedAt: "", receivedAt: "" }]
        : [],
    });

  it("CONVERTED bleibt immer CONVERTED", () => {
    expect(deriveStatus("CONVERTED", baseChecklist(false, false))).toBe("CONVERTED");
  });

  it("vollständige Angaben + erhaltene Dokumente → READY_FOR_REVIEW", () => {
    expect(deriveStatus("WAITING_FOR_CUSTOMER", baseChecklist(true, true))).toBe("READY_FOR_REVIEW");
  });

  it("vollständige Angaben, aber Dokumente nur angefordert/fehlend → COMPLETE, nicht READY_FOR_REVIEW", () => {
    expect(deriveStatus("WAITING_FOR_CUSTOMER", baseChecklist(true, false))).toBe("COMPLETE");
  });

  it("eine gesendete, aber noch nicht zurückerhaltene Vorlage blockiert READY_FOR_REVIEW genauso wie ein fehlendes Dokument", () => {
    const withPendingTemplate = buildChecklist({
      questions: [q({ key: "name", label: "Name" })],
      fields: { name: "Max", service: "Energieausweis" },
      documents: [{ id: "d1", caseId: "c1", companyId: "c1", kind: "floorplan", status: "received", fileName: "", mimeType: "", size: 0, storagePath: "", requestedAt: "", receivedAt: "" }],
      templateSends: [{ id: "t1", title: "Vollmacht", status: "sent" }],
    });
    expect(deriveStatus("WAITING_FOR_CUSTOMER", withPendingTemplate)).toBe("COMPLETE");

    const withReceivedTemplate = buildChecklist({
      questions: [q({ key: "name", label: "Name" })],
      fields: { name: "Max", service: "Energieausweis" },
      documents: [{ id: "d1", caseId: "c1", companyId: "c1", kind: "floorplan", status: "received", fileName: "", mimeType: "", size: 0, storagePath: "", requestedAt: "", receivedAt: "" }],
      templateSends: [{ id: "t1", title: "Vollmacht", status: "received" }],
    });
    expect(deriveStatus("WAITING_FOR_CUSTOMER", withReceivedTemplate)).toBe("READY_FOR_REVIEW");
  });

  it("unvollständig + hint 'waiting' → WAITING_FOR_CUSTOMER", () => {
    expect(deriveStatus("QUALIFYING", baseChecklist(false, false), "waiting")).toBe("WAITING_FOR_CUSTOMER");
  });

  it("unvollständig + hint 'chat' → QUALIFYING", () => {
    expect(deriveStatus("NEW", baseChecklist(false, false), "chat")).toBe("QUALIFYING");
  });
});

describe("effectiveStatus", () => {
  it("markiert lange inaktive QUALIFYING-Fälle als WAITING_FOR_CUSTOMER", () => {
    const stale = new Date(Date.now() - STALE_AFTER_MS - 1000).toISOString();
    expect(effectiveStatus({ status: "QUALIFYING", updatedAt: stale })).toBe("WAITING_FOR_CUSTOMER");
  });

  it("lässt frische QUALIFYING-Fälle unverändert", () => {
    expect(effectiveStatus({ status: "QUALIFYING", updatedAt: new Date().toISOString() })).toBe("QUALIFYING");
  });

  it("betrifft nur QUALIFYING, andere Status bleiben unverändert", () => {
    const stale = new Date(Date.now() - STALE_AFTER_MS - 1000).toISOString();
    expect(effectiveStatus({ status: "NEW", updatedAt: stale })).toBe("NEW");
  });
});

describe("readinessOf", () => {
  it("READY_FOR_REVIEW/CONVERTED sind immer 'ready'", () => {
    const checklist = buildChecklist({ questions: [], fields: {}, documents: [] });
    expect(readinessOf("READY_FOR_REVIEW", checklist)).toBe("ready");
    expect(readinessOf("CONVERTED", checklist)).toBe("ready");
  });

  it("100% ohne fertigen Status → 'complete'", () => {
    // Fördermittelberatung ohne Overrides: kein Pflichtdokument, keine Pflichtfragen → nichts fehlt.
    const checklist = buildChecklist({ questions: [], fields: { service: "Fördermittelberatung" }, documents: [] });
    expect(checklist.percent).toBe(100);
    expect(readinessOf("QUALIFYING", checklist)).toBe("complete");
  });

  it("wenige fehlende Punkte → 'almost', mehr → 'incomplete'", () => {
    const questions = [q({ key: "a", label: "A" }), q({ key: "b", label: "B" }), q({ key: "c", label: "C" }), q({ key: "d", label: "D" })];
    const almost = buildChecklist({ questions, fields: { a: "x", b: "x", c: "x" }, documents: [] });
    const incomplete = buildChecklist({ questions, fields: {}, documents: [] });
    expect(readinessOf("QUALIFYING", almost)).toBe("almost");
    expect(readinessOf("QUALIFYING", incomplete)).toBe("incomplete");
  });
});
