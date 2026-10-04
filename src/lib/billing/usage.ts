import type { Store } from "@/lib/data/store";
import { caseLimitFor, hasAiTools } from "./limits";

/** true = dieses Büro darf die KI-Werkzeuge (Voreinschätzung/Förderschätzung/Bauteilwerte) und
 * PDF-Vorlagen/Nachrichtentexte je Leistung nutzen (ab Pro-Plan). */
export async function planHasAiTools(store: Store): Promise<boolean> {
  const sub = await store.getSubscription();
  return hasAiTools(sub.plan);
}

export const AI_TOOLS_LOCKED_TEXT = "Diese Funktion ist ab dem Pro-Plan verfügbar. Bitte Plan in den Einstellungen → Abrechnung upgraden.";

/** Anzahl Fälle, die im laufenden Kalendermonat (UTC) angelegt wurden. */
export async function casesThisMonth(store: Store): Promise<number> {
  const cases = await store.listCases();
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return cases.filter((c) => {
    const d = new Date(c.createdAt);
    return d.getUTCFullYear() === y && d.getUTCMonth() === m;
  }).length;
}

export interface CaseQuota {
  allowed: boolean;
  limit: number | null;
  used: number;
}

/** Prüft, ob dieses Büro diesen Monat noch einen neuen Fall anlegen darf (abhängig vom Abo-Plan). */
export async function canCreateCase(store: Store): Promise<CaseQuota> {
  const [sub, used] = await Promise.all([store.getSubscription(), casesThisMonth(store)]);
  const limit = caseLimitFor(sub.plan);
  return { allowed: limit === null || used < limit, limit, used };
}
