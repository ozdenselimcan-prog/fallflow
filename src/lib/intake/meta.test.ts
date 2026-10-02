import { describe, expect, it } from "vitest";
import type { CaseRecord, Question } from "@/lib/data/types";
import { buildCaseMeta } from "./meta";

const BASE_CASE: CaseRecord = {
  id: "c1",
  companyId: "demo",
  status: "QUALIFYING",
  completeness: 0,
  customerName: "Max Mustermann",
  service: "Fördermittelberatung",
  source: "widget",
  summary: "",
  assignedTo: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  fields: { service: "Fördermittelberatung" },
  uploadToken: null,
  uploadTokenExpiresAt: null,
};

/** Regressionstest: die Dashboard-/Fallliste-Übersicht muss dieselben Förder-Overrides respektieren wie die Fallakte. */
describe("buildCaseMeta", () => {
  it("zählt Energieausweis/Grundriss bei Fördermittelberatung nur mit, wenn das Büro das explizit verlangt", () => {
    const withoutOverride = buildCaseMeta([BASE_CASE], [] as Question[], []);
    const withOverride = buildCaseMeta([BASE_CASE], [] as Question[], [], { energyCertificate: true, floorplan: true });

    expect(withoutOverride.c1.percent).toBe(100);
    expect(withoutOverride.c1.missing).toHaveLength(0);

    expect(withOverride.c1.percent).toBeLessThan(100);
    expect(withOverride.c1.missing.length).toBeGreaterThan(0);
  });
});
