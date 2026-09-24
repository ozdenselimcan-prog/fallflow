import type { CaseDocument, CaseRecord, Question } from "@/lib/data/types";
import { buildChecklist, readinessOf, type Readiness } from "./checklist";

export interface CaseMeta {
  percent: number;
  missing: string[];
  readiness: Readiness;
  /** Angeforderte, noch nicht erhaltene Dokumente */
  openDocuments: number;
}

/** Berechnet für eine Fallliste Vollständigkeit, fehlende Punkte und Readiness (eine Checkliste pro Fall). */
export function buildCaseMeta(cases: CaseRecord[], questions: Question[], documents: CaseDocument[]): Record<string, CaseMeta> {
  const byCase = new Map<string, CaseDocument[]>();
  for (const d of documents) byCase.set(d.caseId, [...(byCase.get(d.caseId) ?? []), d]);
  return Object.fromEntries(
    cases.map((c) => {
      const docs = byCase.get(c.id) ?? [];
      const checklist = buildChecklist({ questions, fields: c.fields, documents: docs });
      return [
        c.id,
        {
          percent: checklist.percent,
          missing: checklist.missing.map((i) => i.label),
          readiness: readinessOf(c.status, checklist),
          openDocuments: docs.filter((d) => d.status === "requested").length,
        },
      ];
    }),
  );
}
