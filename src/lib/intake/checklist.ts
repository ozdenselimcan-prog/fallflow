import { isAnswered, SKIPPED } from "@/lib/cases/completeness";
import { DOCUMENT_LABELS, ENERGY_SOURCE_BY_HEATING } from "@/lib/cases/fields";
import type { CaseDocument, CaseStatus, DocumentKind, Question } from "@/lib/data/types";

/**
 * Reine Logik (ohne Server-Abhängigkeiten, läuft auch im Browser):
 * Vollständigkeits-Checkliste, Dokumentenbedarf, Lead-Readiness und Statusableitung.
 */

const ENERGY_CERT_SERVICES = ["iSFP", "Energieberatung", "Sanierung", "Fördermittelberatung", "Baubegleitung", "Heizung"];
const FLOORS_SERVICES = ["iSFP", "Sanierung", "Baubegleitung"];

export interface DocumentRequirement {
  kind: DocumentKind;
  label: string;
  required: boolean;
  reason: string;
}

/** Welche Dokumente für diesen Fall gebraucht werden – abhängig von der gewünschten Leistung. */
export function documentRequirements(fields: Record<string, string>): DocumentRequirement[] {
  const service = fields.service ?? "";
  const out: DocumentRequirement[] = [{ kind: "floorplan", label: DOCUMENT_LABELS.floorplan, required: true, reason: "Grundlage für die Gebäudeaufnahme" }];
  if (ENERGY_CERT_SERVICES.includes(service)) {
    out.push({ kind: "energy_certificate", label: DOCUMENT_LABELS.energy_certificate, required: true, reason: "Ausgangswerte des Gebäudes" });
  }
  out.push({ kind: "photos", label: DOCUMENT_LABELS.photos, required: false, reason: "Fassade, Heizung, Dach – erleichtert die Vorbereitung" });
  return out;
}

/** Ist diese Frage für den konkreten Fall relevant? Irrelevante Fragen stellt die KI nicht. */
export function isRelevant(question: Pick<Question, "key">, fields: Record<string, string>): boolean {
  if (question.key === "floors") return fields.buildingType === "Mehrfamilienhaus" || FLOORS_SERVICES.includes(fields.service ?? "");
  return true;
}

/** Aus bekannten Angaben ableitbare Felder (werden nie erfragt). */
export function deriveFields(fields: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const source = ENERGY_SOURCE_BY_HEATING[fields.heating ?? ""];
  if (source && !isAnswered(fields, "energySource")) out.energySource = source;
  return out;
}

export interface ChecklistItem {
  key: string;
  label: string;
  kind: "field" | "document";
  required: boolean;
  done: boolean;
  /** Nur bei Dokumenten: wurde beim Kunden angefordert (oder bereits erhalten)? */
  requested?: boolean;
}

export interface Checklist {
  items: ChecklistItem[];
  /** Fehlende Pflichtpunkte (Angaben + Dokumente) */
  missing: ChecklistItem[];
  missingFields: ChecklistItem[];
  /** Fehlende Pflichtdokumente, die noch nicht angefordert wurden */
  unrequestedDocuments: ChecklistItem[];
  requiredTotal: number;
  requiredDone: number;
  percent: number;
  /** Alle Pflichtangaben (ohne Dokumente) vorhanden */
  dataComplete: boolean;
}

export function buildChecklist(input: { questions: Question[]; fields: Record<string, string>; documents: CaseDocument[] }): Checklist {
  const { fields, documents } = input;
  const items: ChecklistItem[] = [];

  for (const q of [...input.questions].sort((a, b) => a.position - b.position)) {
    if (!q.active || !isRelevant(q, fields)) continue;
    const done = isAnswered(fields, q.key) && fields[q.key] !== SKIPPED;
    items.push({ key: q.key, label: q.label, kind: "field", required: q.required, done });
  }
  for (const req of documentRequirements(fields)) {
    const done = documents.some((d) => d.kind === req.kind && d.status === "received");
    const requested = done || documents.some((d) => d.kind === req.kind && d.status === "requested");
    items.push({ key: `doc:${req.kind}`, label: req.label, kind: "document", required: req.required, done, requested });
  }

  const required = items.filter((i) => i.required);
  const requiredDone = required.filter((i) => i.done).length;
  const missing = required.filter((i) => !i.done);
  const missingFields = missing.filter((i) => i.kind === "field");
  return {
    items,
    missing,
    missingFields,
    unrequestedDocuments: missing.filter((i) => i.kind === "document" && !i.requested),
    requiredTotal: required.length,
    requiredDone,
    percent: required.length === 0 ? 100 : Math.round((requiredDone / required.length) * 100),
    dataComplete: missingFields.length === 0,
  };
}

export const missingLabel = (n: number) => (n === 0 ? "Alle Informationen liegen vor" : n === 1 ? "Noch 1 Information fehlt" : `Noch ${n} Informationen fehlen`);

export type StatusHint = "chat" | "waiting" | "edit";

/** Leitet den Prozessstatus aus dem Fallstand ab. CONVERTED bleibt immer erhalten. */
export function deriveStatus(current: CaseStatus, checklist: Checklist, hint: StatusHint = "edit"): CaseStatus {
  if (current === "CONVERTED") return "CONVERTED";
  if (checklist.dataComplete) return checklist.unrequestedDocuments.length === 0 ? "READY_FOR_REVIEW" : "COMPLETE";
  if (hint === "waiting") return "WAITING_FOR_CUSTOMER";
  if (hint === "chat") return "QUALIFYING";
  return current === "NEW" || current === "QUALIFYING" || current === "WAITING_FOR_CUSTOMER" ? current : "QUALIFYING";
}

/** Nach dieser Zeit ohne Aktivität gilt ein laufendes Gespräch als „wartet auf Kunde“. */
export const STALE_AFTER_MS = 30 * 60_000;

export function effectiveStatus(c: { status: CaseStatus; updatedAt: string }, now = Date.now()): CaseStatus {
  if (c.status === "QUALIFYING" && now - Date.parse(c.updatedAt) > STALE_AFTER_MS) return "WAITING_FOR_CUSTOMER";
  return c.status;
}

/** Lead-Readiness: reiner Prozessstatus, keine Bewertung der Person und keine Kaufwahrscheinlichkeit. */
export type Readiness = "incomplete" | "almost" | "complete" | "ready";
export const READINESS_LABELS: Record<Readiness, string> = {
  incomplete: "Unvollständig",
  almost: "Fast vollständig",
  complete: "Vollständig",
  ready: "Bereit zur Bearbeitung",
};

export function readinessOf(status: CaseStatus, checklist: Checklist): Readiness {
  if (status === "READY_FOR_REVIEW" || status === "CONVERTED") return "ready";
  if (checklist.percent >= 100) return "complete";
  if (checklist.missing.length <= 2) return "almost";
  return "incomplete";
}
