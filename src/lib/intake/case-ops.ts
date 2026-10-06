import { randomBytes } from "node:crypto";
import { summarizeCase } from "@/lib/ai/summary";
import { verifyFilledTemplate } from "@/lib/ai/verify-filled-template";
import { buildSummary } from "@/lib/cases/completeness";
import { DOCUMENT_LABELS, STATUS_LABELS } from "@/lib/cases/fields";
import { siteConfig } from "@/lib/config/site";
import type { Store } from "@/lib/data/store";
import type { Appointment, CaseDocument, CaseRecord, DocumentKind } from "@/lib/data/types";
import { extractPdfText } from "@/lib/documents/pdf-text";
import { saveFile } from "@/lib/documents/storage";
import { deliverToCustomer } from "@/lib/integrations/outbound";
import { buildChecklist, deriveFields, deriveStatus, type Checklist, type StatusHint } from "./checklist";
import { documentRequestMessage, infoReminderMessage } from "./messages";
import { appointmentConfirmedText, formatSlot } from "./scheduling";

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

/**
 * Verbucht eine per E-Mail als Anhang zurückgeschickte, ausgefüllte Büro-Vorlage (z. B. Vollmacht) –
 * der Kunde schickt sie einfach als Antwort auf unsere Mail zurück, kein Upload-Link nötig. Die KI
 * schätzt informativ ein, ob sie ausgefüllt wirkt; das Dokument gilt trotzdem als eingegangen.
 * Gibt false zurück, wenn gerade keine Vorlage für diesen Fall ausstand.
 */
export async function receiveFilledTemplate(store: Store, caseId: string, bytes: Uint8Array, fileName: string): Promise<boolean> {
  const pending = (await store.listTemplateDocuments(caseId)).find((t) => t.status === "sent");
  if (!pending) return false;
  const c = await store.getCase(caseId);
  if (!c) return false;

  const storagePath = await saveFile({ companyId: c.companyId, caseId, bytes, mime: "application/pdf" });
  const text = await extractPdfText(bytes.slice());
  const templates = await store.listDocumentTemplates();
  const title = templates.find((t) => t.id === pending.templateId)?.title ?? fileName;
  const { note } = text ? await verifyFilledTemplate(title, text) : { note: "" };

  await store.saveTemplateDocument({ id: pending.id, caseId, templateId: pending.templateId, status: "received", storagePath, aiNote: note, receivedAt: new Date().toISOString() });
  await store.addEvent(caseId, "document", note ? `Vorlage per E-Mail zurückerhalten: ${title} (${note})` : `Vorlage per E-Mail zurückerhalten: ${title}`);
  await refreshCase(store, caseId, { hint: "edit" });
  return true;
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
  const [current, questions, settings, company, templateDocs, templates] = await Promise.all([
    store.getCase(caseId),
    store.listQuestions(),
    store.getAssistant(),
    store.getCompany(),
    store.listTemplateDocuments(caseId),
    store.listDocumentTemplates(),
  ]);
  if (!current) throw new Error("Fall nicht gefunden");

  let c = current;
  let documents = await store.listDocuments(caseId);
  const derived = deriveFields(c.fields);
  const fields = { ...c.fields, ...derived };
  const foerderOverrides = { energyCertificate: company.foerderEnergyCertificate, floorplan: company.foerderFloorplan };
  const templateTitleById = new Map(templates.map((t) => [t.id, t.title]));
  const templateSends = templateDocs.map((td) => ({ id: td.id, title: templateTitleById.get(td.templateId) ?? "Vorlage", status: td.status }));
  let checklist = buildChecklist({ questions, fields, documents, foerderOverrides, templateSends });

  let requestedNow: DocumentKind[] = [];
  let uploadLink: string | null = null;
  if (opts.autoRequestDocs && settings.autoFollowUp && checklist.dataComplete && checklist.unrequestedDocuments.length > 0) {
    const kinds = checklist.unrequestedDocuments.filter((i) => i.key.startsWith("doc:")).map((i) => i.key.replace("doc:", "") as DocumentKind);
    if (kinds.length) {
      const res = await requestDocuments(store, c, kinds);
      requestedNow = res.requested;
      uploadLink = res.url;
      documents = await store.listDocuments(caseId);
      checklist = buildChecklist({ questions, fields, documents, foerderOverrides, templateSends });
      c = (await store.getCase(caseId)) ?? c;
    }
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
    // Klassische Dokumentarten und zurückerwartete Büro-Vorlagen ("template:…", kein fester DocumentKind)
    // getrennt behandeln – letztere haben keinen Eintrag in den Dokumentart-Textbausteinen.
    const docMissing = checklist.missing.filter((i) => i.key.startsWith("doc:"));
    const templateMissing = checklist.missing.filter((i) => i.key.startsWith("template:"));
    const parts: string[] = [];
    if (docMissing.length) {
      const kinds = docMissing.map((i) => i.key.replace("doc:", "") as DocumentKind);
      parts.push(documentRequestMessage({ name: c.fields.name, kinds, url: uploadUrl(token), reminder: true }));
    }
    if (templateMissing.length) {
      const list = templateMissing.map((i) => i.label).join(", ");
      const greetingLine = c.fields.name?.trim() ? `Guten Tag ${c.fields.name.trim()},` : "Guten Tag,";
      parts.push(
        docMissing.length
          ? `Außerdem fehlt uns noch die ausgefüllte Vorlage: ${list}. Bitte einfach als Antwort auf diese E-Mail mit dem ausgefüllten Dokument als Anhang zurücksenden.`
          : `${greetingLine}\n\nuns fehlt noch die ausgefüllte Vorlage: ${list}. Bitte einfach als Antwort auf diese E-Mail mit dem ausgefüllten Dokument als Anhang zurücksenden.\n\nVielen Dank!`,
      );
    }
    message = parts.join("\n\n");
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

export type ConfirmAppointmentResult =
  | { ok: true; appointment: Appointment; delivered: boolean; reason: string }
  | { ok: false; status: number; message: string };

/**
 * Mitarbeiter gibt einen KI-vorgeschlagenen Termin frei – entweder unverändert (Akzeptieren) oder mit
 * einem selbst gewählten Zeitpunkt (Ablehnen + eigener Termin). In beiden Fällen gilt der Termin danach
 * als bestätigt und der Kunde erfährt jetzt zum ersten Mal den genauen Zeitpunkt – vorher kannte er ihn
 * bewusst nicht (siehe engine.ts, appointmentPendingReviewText).
 */
export async function confirmAppointment(store: Store, appointmentId: string, overrideStartsAt?: string): Promise<ConfirmAppointmentResult> {
  const appt = (await store.listAppointments()).find((a) => a.id === appointmentId);
  if (!appt) return { ok: false, status: 404, message: "Termin nicht gefunden" };
  if (!appt.caseId) return { ok: false, status: 400, message: "Termin ist keinem Fall zugeordnet" };
  const c = await store.getCase(appt.caseId);
  if (!c) return { ok: false, status: 404, message: "Fall nicht gefunden" };

  const saved = await store.saveAppointment({ ...appt, startsAt: overrideStartsAt ?? appt.startsAt, status: "confirmed" });
  await store.updateCase(c.id, { fields: { apptStage: "confirmed" } });
  await store.addEvent(
    c.id,
    "appointment",
    overrideStartsAt ? `Vorschlag abgelehnt, Team hat stattdessen bestätigt: ${formatSlot(new Date(saved.startsAt))}` : `Termin vom Team bestätigt: ${formatSlot(new Date(saved.startsAt))}`,
  );

  const text = appointmentConfirmedText(new Date(saved.startsAt));
  const channel = "email" as const;
  const result = await deliverToCustomer({ companyId: c.companyId, channel, email: c.fields.email, phone: c.fields.phone, text, subject: "Ihr Beratungstermin" });
  await store.addMessage(c.id, "staff", text, { channel, delivery: result.delivered ? "delivered" : "not_sent" });

  return { ok: true, appointment: saved, delivered: result.delivered, reason: result.reason };
}
