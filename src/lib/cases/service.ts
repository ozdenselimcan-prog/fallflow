import type { Store } from "@/lib/data/store";
import type { CaseRecord } from "@/lib/data/types";
import { buildSummary, computeCompleteness } from "./completeness";

/** Speichert geänderte Felder und berechnet Vollständigkeit, Kundenname, Leistung und Zusammenfassung neu. */
export async function saveCaseFields(store: Store, existing: CaseRecord, changes: Record<string, string>) {
  const fields = { ...existing.fields, ...changes };
  const questions = await store.listQuestions();
  const completeness = computeCompleteness(questions, fields);
  const status = existing.status === "NEEDS_INFO" && completeness === 100 ? "COMPLETE" : existing.status;
  if (status !== existing.status) await store.addEvent(existing.id, "complete", "Fall vollständig");
  return store.updateCase(existing.id, {
    fields: changes,
    completeness,
    status,
    customerName: fields.name || existing.customerName,
    service: fields.service ?? existing.service,
    summary: buildSummary(fields),
  });
}
