import { randomBytes } from "node:crypto";
import { summarizeCase } from "@/lib/ai/summary";
import { buildSummary } from "@/lib/cases/completeness";
import { DOCUMENT_LABELS, STATUS_LABELS } from "@/lib/cases/fields";
import { siteConfig } from "@/lib/config/site";
import type { Store } from "@/lib/data/store";
import type { CaseDocument, CaseRecord, DocumentKind } from "@/lib/data/types";
import { buildChecklist, deriveFields, deriveStatus, type Checklist, type StatusHint } from "./checklist";
import { documentRequestMessage, infoReminderMessage } from "./messages";

/** Fall-Operationen, die Website-Chat, Inbox, Uploads und Dashboard gemeinsam nutzen. */

export const UPLOAD_TTL_MS = 30 * 86_400_000;
export const uploadUrl = (token: string) => `${siteConfig.appUrl}/upload/${token}`;

/** Gültiger Upload-Link des Falls oder null (kein Token bzw. abgelaufen). */
export function currentUploadLink(c: Pick<CaseRecord, "uploadToken" | "uploadTokenExpiresAt">): string | null {
  return c.uploadToken && c.uploadTokenExpiresAt && Date.parse(c.uploadTokenExpiresAt) > Date.now() ? uploadUrl(c.uploadToken) : null;
}

const nextMorning = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
};

/** Liefert einen gültigen Upload-Token für den Fall (erzeugt/erneuert ihn bei Bedarf). */
export async function ensureUploadToken(store: Store, c: CaseRecord): Promise<string> {
  const stillValid = c.uploadToken && c.uploadTokenExpiresAt && Date.parse(c.uploadTokenExpiresAt) > Date.now() + 86_400_000;
  if (stillValid) return c.uploadToken!;
  const token = randomBytes(24).toString("base64url");
  await store.updateCase(c.id, { uploadToken: token, uploadTokenExpiresAt: new Date(Date.now() + UPLOAD_TTL_MS).toISOString(), keepTimestamp: true });
  return token;
}

/** Fordert Dokumente beim Kunden an (legt „requested“-Einträge an). Bereits angeforderte/erhaltene Arten werden übersprungen. */
export async function requestDocuments(store: Store, c: CaseRecord, kinds: DocumentKind[]): Promise<{ url: string; requested: DocumentKind[] }> {
  const existing = await store.listDocuments(c.id);
  const token = await ensureUploadToken(store, c);
  const requested: DocumentKind[] = [];
  for (const kind of kinds) {
    if (existing.some((d) => d.kind === kind)) continue;
    await store.saveDocument({
      caseId: c.id,
      kind,
      status: "requested",
      fileName: "",
      mimeType: "",
      size: 0,
      storagePath: "",
      requestedAt: new Date().toISOString(),
      receivedAt: null,
    });
    requested.push(kind);
  }
  if (requested.length) {
    await store.addEvent(c.id, "document", `${requested.length > 1 ? "Dokumente" : "Dokument"} angefordert: ${requested.map((k) => DOCUMENT_LABELS[k]).join(", ")}`);
  }
  return { url: uploadUrl(token), requested };
}

/** Verbucht einen Kunden-Upload: füllt einen offenen Anforderungseintrag oder legt ein neues Dokument an. */
export async function registerUpload(
  store: Store,
  c: CaseRecord,
  file: { kind: DocumentKind; fileName: string; mimeType: string; size: number; storagePath: string },
): Promise<CaseDocument> {
  const docs = await store.listDocuments(c.id);
  const open = docs.find((d) => d.kind === file.kind && d.status === "requested");
  const now = new Date().toISOString();
  const saved = await store.saveDocument({
    id: open?.id,
    caseId: c.id,
    kind: file.kind,
    status: "received",
    fileName: file.fileName,
    mimeType: file.mimeType,
    size: file.size,
    storagePath: file.storagePath,
    requestedAt: open?.requestedAt ?? now,
    receivedAt: now,
  });
  await store.addEvent(c.id, "document", `Dokument erhalten: ${DOCUMENT_LABELS[file.kind]}`);
  return saved;
}

export interface RefreshOptions {
  /** Herkunft des Anlasses: Gespräch läuft, Kunde soll liefern, oder reine Bearbeitung */
  hint?: StatusHint;
  /** Fehlende Pflichtdokumente automatisch anfordern, sobald alle Angaben vorliegen */
  autoRequestDocs?: boolean;
  /** false = „zuletzt aktiv“ nicht anfassen */
  touch?: boolean;
}

export interface RefreshResult {
  caseRecord: CaseRecord;
  checklist: Checklist;
  documents: CaseDocument[];
  requestedNow: DocumentKind[];
  uploadLink: string | null;
  becamePrepared: boolean;
}

const PREPARED = ["COMPLETE", "READY_FOR_REVIEW", "CONVERTED"];

/**
 * Berechnet Vollständigkeit, Status und Zusammenfassung eines Falls neu und hält Follow-ups aktuell.
 * Wird nach jeder Änderung aufgerufen (Chat-Nachricht, Upload, Bearbeitung, Notiz).
 */
export async function refreshCase(store: Store, caseId: string, opts: RefreshOptions = {}): Promise<RefreshResult> {
  const [current, questions, settings] = await Promise.all([store.getCase(caseId), store.listQuestions(), store.getAssistant()]);
  if (!current) throw new Error("Fall nicht gefunden");

  let c = current;
  let documents = await store.listDocuments(caseId);
  const derived = deriveFields(c.fields);
  const fields = { ...c.fields, ...derived };
  let checklist = buildChecklist({ questions, fields, documents });

  let requestedNow: DocumentKind[] = [];
  let uploadLink: string | null = null;
  if (opts.autoRequestDocs && settings.autoFollowUp && checklist.dataComplete && checklist.unrequestedDocuments.length > 0) {
    const kinds = checklist.unrequestedDocuments.map((i) => i.key.replace("doc:", "") as DocumentKind);
    const res = await requestDocuments(store, c, kinds);
    requestedNow = res.requested;
    uploadLink = res.url;
    documents = await store.listDocuments(caseId);
    checklist = buildChecklist({ questions, fields, documents });
    c = (await store.getCase(caseId)) ?? c;
  }

  const previous = c.status;
  const status = deriveStatus(previous, checklist, opts.hint);
  const becamePrepared = (status === "COMPLETE" || status === "READY_FOR_REVIEW") && !PREPARED.includes(previous);

  let summary = c.summary;
  if (checklist.dataComplete) {
    if (becamePrepared || !summary) summary = (await summarizeCase(fields)).text;
  } else {
    summary = fields.buildingType || fields.service ? buildSummary(fields) : "";
  }

  const updated = await store.updateCase(caseId, {
    status,
    completeness: checklist.percent,
    summary,
    customerName: fields.name || c.customerName,
    service: fields.service ?? c.service,
    fields: Object.keys(derived).length ? derived : undefined,
    keepTimestamp: opts.touch === false,
  });

  if (becamePrepared) await store.addEvent(caseId, "prepared", "Fall automatisch vorbereitet");
  else if (status !== previous) await store.addEvent(caseId, "status", `Status: ${STATUS_LABELS[status]}`);

  const result = updated ?? { ...c, status, completeness: checklist.percent, summary };
  await syncFollowUps(store, result, checklist);
  return { caseRecord: result, checklist, documents, requestedNow, uploadLink, becamePrepared };
}

/** Plant genau ein Follow-up, solange etwas fehlt; bricht es ab, sobald alles vorliegt. */
export async function syncFollowUps(store: Store, c: CaseRecord, checklist: Checklist, opts: { force?: boolean } = {}) {
  const settings = await store.getAssistant();
  const planned = (await store.listFollowUps(c.id)).filter((f) => f.status === "planned");
  const needsFollowUp = c.status !== "CONVERTED" && checklist.missing.length > 0;

  if (!needsFollowUp) {
    for (const f of planned) await store.saveFollowUp({ ...f, status: "cancelled", note: "Nicht mehr nötig – alle Informationen liegen vor." });
    return;
  }
  if ((!opts.force && !settings.autoFollowUp) || !(c.fields.email || c.fields.phone)) return;

  const onlyDocsMissing = checklist.missingFields.length === 0;
  let message: string;
  let kind: "document" | "info";
  if (onlyDocsMissing) {
    const token = await ensureUploadToken(store, c);
    const kinds = checklist.missing.map((i) => i.key.replace("doc:", "") as DocumentKind);
    message = documentRequestMessage({ name: c.fields.name, kinds, url: uploadUrl(token), reminder: true });
    kind = "document";
  } else {
    message = infoReminderMessage({ name: c.fields.name, missing: checklist.missing.map((i) => i.label) });
    kind = "info";
  }

  const existing = planned[0];
  if (existing) {
    if (existing.message !== message || existing.kind !== kind) await store.saveFollowUp({ ...existing, message, kind });
    return;
  }
  await store.saveFollowUp({ caseId: c.id, kind, message, scheduledFor: nextMorning(1), status: "planned", sentAt: null, note: "" });
  await store.addEvent(c.id, "followup", "Follow-up geplant für morgen");
}
