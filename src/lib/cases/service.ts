import { refreshCase } from "@/lib/intake/case-ops";
import type { Store } from "@/lib/data/store";
import type { CaseRecord } from "@/lib/data/types";

/** Speichert geänderte Felder und berechnet Vollständigkeit, Status, Kundenname, Leistung und Zusammenfassung neu. */
export async function saveCaseFields(store: Store, existing: CaseRecord, changes: Record<string, string>): Promise<CaseRecord> {
  await store.updateCase(existing.id, { fields: changes });
  return (await refreshCase(store, existing.id, { hint: "edit" })).caseRecord;
}
