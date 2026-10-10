import type { CaseDocument, CaseRecord, DocumentTemplate, Question, ServiceMessage, TemplateDocument } from "@/lib/data/types";
import { buildChecklist, readinessOf, type FoerderDocumentOverrides, type Readiness } from "./checklist";

export interface CaseMeta {
  percent: number;
  missing: string[];
  readiness: Readiness;
  /** Angeforderte, noch nicht erhaltene Dokumente */
  openDocuments: number;
}

/** Berechnet für eine Fallliste Vollständigkeit, fehlende Punkte und Readiness (eine Checkliste pro Fall). */
export function buildCaseMeta(
  cases: CaseRecord[],
  questions: Question[],
  documents: CaseDocument[],
  foerderOverrides?: FoerderDocumentOverrides,
  templateDocs: TemplateDocument[] = [],
  templates: DocumentTemplate[] = [],
  serviceMessages: ServiceMessage[] = [],
): Record<string, CaseMeta> {
  const byCase = new Map<string, CaseDocument[]>();
  for (const d of documents) byCase.set(d.caseId, [...(byCase.get(d.caseId) ?? []), d]);
  const templateTitleById = new Map(templates.map((t) => [t.id, t.title]));
  const templateSendsByCase = new Map<string, { id: string; title: string; status: "sent" | "received"; filled: boolean | null }[]>();
  for (const td of templateDocs) {
    const entry = { id: td.id, title: templateTitleById.get(td.templateId) ?? "Vorlage", status: td.status, filled: td.filled };
    templateSendsByCase.set(td.caseId, [...(templateSendsByCase.get(td.caseId) ?? []), entry]);
  }
  return Object.fromEntries(
    cases.map((c) => {
      const docs = byCase.get(c.id) ?? [];
      const checklist = buildChecklist({ questions, fields: c.fields, documents: docs, foerderOverrides, serviceMessages, templateSends: templateSendsByCase.get(c.id), includeFields: c.source !== "email" });
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
