import { isAnswered, SKIPPED } from "@/lib/cases/completeness";
import { DOCUMENT_LABELS, ENERGY_SOURCE_BY_HEATING } from "@/lib/cases/fields";
import type { CaseDocument, CaseStatus, DocumentKind, Question, ServiceMessage } from "@/lib/data/types";
import { requestedFieldKeys } from "./requested-fields";

/**
 * Reine Logik (ohne Server-Abhängigkeiten, läuft auch im Browser):
 * Vollständigkeits-Checkliste, Dokumentenbedarf, Lead-Readiness und Statusableitung.
 */

export const ENERGY_CERT_SERVICES = ["iSFP", "Energieberatung", "Sanierung", "Baubegleitung", "Heizung"];
const FLOORS_SERVICES = ["iSFP", "Sanierung", "Baubegleitung"];
/** Für diese Leistung sind Energieausweis/Grundriss je Büro einstellbar (Standard: nicht nötig). */
export const FOERDER_SERVICE = "Fördermittelberatung";

export interface DocumentRequirement {
  kind: DocumentKind;
  label: string;
  required: boolean;
  reason: string;
}

export interface FoerderDocumentOverrides {
  energyCertificate: boolean;
  floorplan: boolean;
  /** Betrieb mit Betriebsprofil (FallFlow): keine Energieberatungs-Standardunterlagen (Grundriss, Energieausweis). */
  profiled?: boolean;
}

/** Standard-Dokumentbedarf einer Leistung, ohne jede Büro-Einstellung – Basis für die Checkbox-Anzeige "Vorlagen & Nachrichten". */
export function defaultDocumentRequirements(service: string): { floorplan: boolean; energyCertificate: boolean } {
  return { floorplan: service !== FOERDER_SERVICE, energyCertificate: ENERGY_CERT_SERVICES.includes(service) };
}

/** Welche Dokumente für diesen Fall gebraucht werden – abhängig von der gewünschten Leistung, dem (veralteten,
 * nur für Fördermittelberatung genutzten) Firmen-Override und der je Leistung einstellbaren Vorlagen-&-
 * Nachrichten-Konfiguration (serviceMessages – hat Vorrang, falls dort ausdrücklich gesetzt). */
export function documentRequirements(fields: Record<string, string>, foerderOverrides?: FoerderDocumentOverrides, serviceMessages?: ServiceMessage[]): DocumentRequirement[] {
  const service = fields.service ?? "";
  const isFoerder = service === FOERDER_SERVICE;
  const out: DocumentRequirement[] = [];
  const override = serviceMessages?.find((m) => m.service === service);
  const defaults = foerderOverrides?.profiled ? { floorplan: false, energyCertificate: false } : defaultDocumentRequirements(service);
  // Grundriss ist sonst immer Pflicht (Basis der Gebäudeaufnahme) – nur bei Fördermittelberatung über den
  // alten Firmen-Override einstellbar, es sei denn, das Büro hat es für diese Leistung ausdrücklich gesetzt.
  const wantsFloorplan = override?.requiresFloorplan ?? (isFoerder ? Boolean(foerderOverrides?.floorplan) : defaults.floorplan);
  if (wantsFloorplan) {
    out.push({ kind: "floorplan", label: DOCUMENT_LABELS.floorplan, required: true, reason: "Grundlage für die Gebäudeaufnahme" });
  }
  const wantsEnergyCert = override?.requiresEnergyCertificate ?? (isFoerder ? Boolean(foerderOverrides?.energyCertificate) : defaults.energyCertificate);
  if (wantsEnergyCert) {
    out.push({ kind: "energy_certificate", label: DOCUMENT_LABELS.energy_certificate, required: true, reason: "Ausgangswerte des Gebäudes" });
  }
  out.push({ kind: "photos", label: DOCUMENT_LABELS.photos, required: false, reason: foerderOverrides?.profiled ? "erleichtert die Vorbereitung" : "Fassade, Heizung, Dach – erleichtert die Vorbereitung" });
  return out;
}

/** Ist diese Frage für den konkreten Fall relevant? Irrelevante Fragen stellt die KI nicht. */
/** Feld "Kontakt über": "Telefon" = Anfrage kam per Anruf – dann wird keine E-Mail-Adresse erfragt. */
export const CONTACT_CHANNEL_KEY = "contactChannel";

export function isRelevant(question: Pick<Question, "key"> & { appliesTo?: string[]; whatsappOnly?: boolean; hiddenOnWhatsApp?: boolean }, fields: Record<string, string>): boolean {
  const viaWhatsApp = fields[CONTACT_CHANNEL_KEY] === "WhatsApp";
  if (question.whatsappOnly && !viaWhatsApp) return false;
  if (question.hiddenOnWhatsApp && viaWhatsApp) return false;
  if (question.key === "email" && (fields[CONTACT_CHANNEL_KEY] === "Telefon" || fields[CONTACT_CHANNEL_KEY] === "WhatsApp")) return false;
  // Angaben aus dem Betriebsprofil, die nur bei bestimmten Leistungen gebraucht werden (Leistung noch offen = fragen).
  if (question.appliesTo?.length && fields.service && !question.appliesTo.includes(fields.service)) return false;
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

export interface TemplateSendInfo {
  id: string;
  title: string;
  status: "sent" | "received" | "info";
  /** KI-Einschätzung, ob die zurückgeschickte Vorlage tatsächlich ausgefüllt ist (false = zählt nicht als erledigt). */
  filled: boolean | null;
}

/** Feld am Fall: "1" = wartet auf die Rückmeldung des Kunden zu im Nachrichtentext angeforderten Unterlagen (setzt refreshCase). */
export const AWAITING_REPLY_KEY = "awaitingReply";

export function buildChecklist(input: {
  questions: Question[];
  fields: Record<string, string>;
  documents: CaseDocument[];
  foerderOverrides?: FoerderDocumentOverrides;
  /** Für den je Leistung einstellbaren Dokumentbedarf (Vorlagen & Nachrichten) – siehe documentRequirements. */
  serviceMessages?: ServiceMessage[];
  /** Vom Büro an diesen Fall gesendete PDF-Vorlagen – fließen als Pflichtdokumente ein, bis sie ausgefüllt zurück sind. */
  templateSends?: TemplateSendInfo[];
  /**
   * false = Frage-Flow-Felder zählen nicht zur Vollständigkeit. Der Frage-Flow ist ausschließlich eine
   * Website-Chat-Funktion (aktive Rückfragen) – bei E-Mail-Fällen fragt die KI nichts davon ab, deshalb
   * dürfen diese Felder dort auch nicht als "fehlend" blockieren. Default true (Website-Chat & Altfälle).
   */
  includeFields?: boolean;
  /**
   * true = Das Büro hat in seiner Nachricht zur Leistung etwas angefordert, das FallFlow nicht als Angabe/Dokument
   * erkennt (z. B. Heizkostenabrechnungen), und der Kunde hat darauf noch nicht geantwortet – dann ist der Fall noch
   * nicht fertig (siehe request-signals.ts).
   */
  awaitingCustomerReply?: boolean;
}): Checklist {
  const { fields, documents, includeFields = true } = input;
  const items: ChecklistItem[] = [];

  if (includeFields) {
    for (const q of [...input.questions].sort((a, b) => a.position - b.position)) {
      if (!q.active || !isRelevant(q, fields)) continue;
      const done = isAnswered(fields, q.key) && fields[q.key] !== SKIPPED;
      items.push({ key: q.key, label: q.label, kind: "field", required: q.required, done });
    }
  } else {
    // Kein Frage-Flow (E-Mail): benötigt ist nur, was das Büro in der Nachricht zur Leistung ausdrücklich
    // verlangt (z. B. "Bitte senden Sie uns Ihre Telefonnummer").
    const message = input.serviceMessages?.find((m) => m.service === (fields.service ?? ""));
    const wanted = new Set(requestedFieldKeys(message?.body ?? ""));
    for (const q of [...input.questions].sort((a, b) => a.position - b.position)) {
      if (!wanted.has(q.key)) continue;
      items.push({ key: q.key, label: q.label, kind: "field", required: true, done: isAnswered(fields, q.key) && fields[q.key] !== SKIPPED });
    }
  }
  for (const req of documentRequirements(fields, input.foerderOverrides, input.serviceMessages)) {
    const done = documents.some((d) => d.kind === req.kind && d.status === "received");
    const requested = done || documents.some((d) => d.kind === req.kind && d.status === "requested");
    items.push({ key: `doc:${req.kind}`, label: req.label, kind: "document", required: req.required, done, requested });
  }
  for (const t of input.templateSends ?? []) {
    if (t.status === "info") continue; // nur zur Information mitgeschickt – kommt nicht zurück
    items.push({ key: `template:${t.id}`, label: t.title, kind: "document", required: true, done: t.status === "received" && t.filled !== false, requested: true });
  }

  if (input.awaitingCustomerReply ?? fields[AWAITING_REPLY_KEY] === "1") {
    items.push({ key: "reply:service", label: "Rückmeldung des Kunden (angeforderte Unterlagen laut Ihrer Nachricht)", kind: "document", required: true, done: false, requested: true });
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
  // "Bereit zur Prüfung" erst, wenn ALLES da ist: alle Pflichtangaben UND alle Pflichtdokumente/Vorlagen. Einen
  // Zwischenstatus "Angaben vollständig" gibt es bewusst nicht mehr – er stand sonst bei einem Fall, dem noch
  // Dokumente fehlten und der z. B. erst bei 25 % war.
  const docsReceived = checklist.items.filter((i) => i.kind === "document" && i.required).every((i) => i.done);
  if (docsReceived && checklist.dataComplete) return "READY_FOR_REVIEW";
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
  if (checklist.missing.length <= 2 && checklist.percent >= 50) return "almost";
  return "incomplete";
}
