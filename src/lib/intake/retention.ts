import type { Store } from "@/lib/data/store";
import { deleteFile } from "@/lib/documents/storage";

/** Anfragen, die nie übernommen wurden, werden so lange nach der letzten Aktivität aufbewahrt (siehe Datenschutzerklärung). */
export const RETENTION_DAYS = 365;

/**
 * Löscht nicht übernommene Fälle (Status ≠ CONVERTED) ohne Aktivität seit RETENTION_DAYS samt Dokumenten,
 * Nachrichten und Verlauf. Übernommene Fälle löscht ausschließlich das Büro selbst.
 */
export async function purgeStaleCases(store: Store, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86_400_000).toISOString();
  const stale = (await store.listCases()).filter((c) => c.status !== "CONVERTED" && c.updatedAt < cutoff);
  if (stale.length === 0) return 0;
  const documents = await store.listDocuments();
  for (const c of stale) {
    for (const d of documents.filter((x) => x.caseId === c.id)) await deleteFile(d.storagePath);
    await store.deleteCase(c.id);
  }
  return stale.length;
}
