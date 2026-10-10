import { randomBytes } from "node:crypto";
import { extractFields } from "@/lib/ai/case-extractor";
import { mergeExtracted } from "@/lib/ai/conversation";
import { summarizeCase } from "@/lib/ai/summary";
import { verifyFilledTemplate } from "@/lib/ai/verify-filled-template";
import { buildSummary } from "@/lib/cases/completeness";
import { DOCUMENT_LABELS, STATUS_LABELS } from "@/lib/cases/fields";
import { siteConfig } from "@/lib/config/site";
import type { Store } from "@/lib/data/store";
import type { Appointment, CaseDocument, CaseRecord, DocumentKind, DocumentTemplate, MessageChannel, ServiceMessage, TemplateDocument } from "@/lib/data/types";
import { extractPdfText } from "@/lib/documents/pdf-text";
import { readFile, saveFile, sniffMime } from "@/lib/documents/storage";
import type { InboundAttachment } from "@/lib/integrations/email";
import { deliverToCustomer } from "@/lib/integrations/outbound";
import { buildChecklist, deriveFields, deriveStatus, type Checklist, type StatusHint } from "./checklist";
import { appointmentConfirmedText, appointmentPendingReviewText, findNextSlot, formatSlot } from "./scheduling";

/** Fall-Operationen, die Website-Chat, Inbox, Uploads und Dashboard gemeinsam nutzen. */

export const UPLOAD_TTL_MS = 30 * 86_400_000;
export const uploadUrl = (token: string) => `${siteConfig.appUrl}/upload/${token}`;

/** Gültiger Upload-Link des Falls oder null (kein Token bzw. abgelaufen). */
export function currentUploadLink(c: Pick<CaseRecord, "uploadToken" | "uploadTokenExpiresAt">): string | null {
  return c.uploadToken && c.uploadTokenExpiresAt && Date.parse(c.uploadTokenExpiresAt) > Date.now() ? uploadUrl(c.uploadToken) : null;
}

/**
 * Grenzt die Auswahl der "Leistung"-Frage auf die vom Büro tatsächlich angebotenen Leistungen ein
 * (plus "Sonstiges" als Auffangoption) – sonst sieht der Kunde im Chat Buttons für Leistungen, die
 * dieses Büro gar nicht anbietet, und die KI würde sie trotzdem als gültig erkennen und bearbeiten.
 * Wird bei jeder Änderung der angebotenen Leistungen (Onboarding, Einstellungen/Unternehmen) aufgerufen.
 */
export async function syncServiceQuestionOptions(store: Store, services: string[]): Promise<void> {
  const question = (await store.listQuestions()).find((q) => q.key === "service");
  if (!question) return;
  const options = [...new Set([...services, "Sonstiges"])];
  await store.saveQuestion({ ...question, options });
}

/**
 * Büro-Vorlage(n) und/oder eigene Leistungs-Nachricht für den erkannten Fall zusammenstellen und als
 * "versendet" markieren – gemeinsam genutzt vom laufenden Gespräch (engine.ts) UND den Follow-up-
 * Erinnerungen (follow-ups.ts), damit beide dieselbe, vom Büro selbst geschriebene Nachricht verschicken
 * statt einer automatisch generierten Angaben-Checkliste. Gibt null zurück, wenn es nichts Neues zu
 * verschicken gibt (z. B. schon gesendet, oder weder Vorlage noch Nachricht für diese Leistung hinterlegt).
 */
export async function matchServiceMaterials(
  store: Store,
  c: CaseRecord,
  templates: DocumentTemplate[],
  serviceMessages: ServiceMessage[],
  channel: MessageChannel,
): Promise<{ texts: string[]; attachments: InboundAttachment[] } | null> {
  const service = c.fields.service ?? "";
  const matchingTemplates = [...(service ? templates.filter((t) => t.service && t.service === service) : []), ...templates.filter((t) => t.alwaysInclude)];
  const uniqueTemplates = [...new Map(matchingTemplates.map((t) => [t.id, t])).values()];
  const texts: string[] = [];
  const attachments: InboundAttachment[] = [];

  if (uniqueTemplates.length) {
    const sentIds = new Set((await store.listTemplateDocuments(c.id)).map((td) => td.templateId));
    const pending = uniqueTemplates.filter((t) => !sentIds.has(t.id));
    if (!pending.length) return null;
    for (const tpl of pending) {
      const customMessage = serviceMessages.find((m) => m.service === tpl.service)?.body.trim();
      if (channel === "email") {
        // Erst die Datei laden und NUR bei Erfolg als "gesendet" markieren bzw. im Text behaupten, sie liege
        // im Anhang – sonst würde bei einem Speicherfehler eine Vorlage als erledigt gelten, obwohl beim
        // Kunden nie ein Anhang ankam (und die KI es dann auch nie erneut versucht).
        const file = await readFile(tpl.storagePath);
        if (!file) {
          await store.addEvent(c.id, "document", `Vorlage „${tpl.title}“ konnte nicht aus dem Speicher geladen werden – bitte unter Vorlagen & Nachrichten erneut hochladen.`);
          continue;
        }
        await store.saveTemplateDocument({ caseId: c.id, templateId: tpl.id, status: "sent", storagePath: "", aiNote: "", receivedAt: null });
        attachments.push({ filename: tpl.fileName, mime: "application/pdf", bytes: file.bytes });
        texts.push(
          customMessage
            ? `${customMessage}\n\n(Das Formular „${tpl.title}“ finden Sie im Anhang dieser E-Mail – bitte ausfüllen und einfach als Antwort auf diese E-Mail mit dem ausgefüllten Dokument als Anhang zurücksenden.)`
            : `Für Ihr Anliegen („${tpl.title}“) finden Sie das Formular im Anhang dieser E-Mail. Bitte ausfüllen und einfach als Antwort auf diese E-Mail mit dem ausgefüllten Dokument als Anhang zurücksenden.`,
        );
      } else {
        await store.saveTemplateDocument({ caseId: c.id, templateId: tpl.id, status: "sent", storagePath: "", aiNote: "", receivedAt: null });
        const token = await ensureUploadToken(store, c);
        const downloadUrl = `${siteConfig.appUrl}/api/upload/${token}/template/${tpl.id}`;
        texts.push(
          customMessage
            ? `${customMessage}\n\nDokument herunterladen: ${downloadUrl}. Bitte ausgefüllt per E-Mail an uns zurücksenden.`
            : `Für Ihr Anliegen („${tpl.title}“) laden Sie sich bitte das Dokument herunter: ${downloadUrl}. Bitte ausgefüllt per E-Mail an uns zurücksenden.`,
        );
      }
      await store.addEvent(c.id, "document", `Vorlage automatisch an Kunden gesendet: ${tpl.title}`);
    }
    return { texts, attachments };
  }

  // Keine PDF-Vorlage für genau diese Leistung – trotzdem die eigene Nachricht einmalig verschicken, sobald
  // die Leistung bekannt ist (z. B. "Hydraulischer Abgleich" ohne Formular).
  const hasServiceSpecificTemplate = service ? templates.some((t) => t.service === service) : false;
  if (service && !hasServiceSpecificTemplate && c.fields.serviceMessageSentFor !== service) {
    const standaloneMessage = serviceMessages.find((m) => m.service === service)?.body.trim();
    if (standaloneMessage) {
      await store.updateCase(c.id, { fields: { serviceMessageSentFor: service } });
      await store.addEvent(c.id, "document", `Nachricht automatisch an Kunden gesendet (${service})`);
      return { texts: [standaloneMessage], attachments: [] };
    }
  }
  return null;
}

/**
 * Bucht automatisch den nächstmöglichen freien Termin für einen Fall (unter Berücksichtigung bestehender
 * Termine inkl. vom Büro eingetragener Blocker und der Tagesobergrenze) und lässt ihn vom Team freigeben –
 * genau wie der Terminvorschlag im Website-Chat (siehe engine.ts), nur ohne vorherige "Welche Tage passen
 * Ihnen?"-Rückfrage (die ist eine reine Website-Chat-Funktion). Wird auch nach einer per E-Mail
 * zurückgeschickten, korrekt ausgefüllten Vorlage aufgerufen (siehe receiveFilledTemplate) – der Berater
 * braucht den Kalendereintrag unabhängig davon, über welchen Kanal der Fall fertig wurde (z. B. weil er nur
 * eine begrenzte Anzahl Termine pro Tag vergeben kann). Tut nichts, wenn Terminvergabe aus ist, bereits ein
 * Termin läuft, oder kein freier Slot gefunden wird. Gibt true zurück, wenn ein Termin vorgeschlagen wurde.
 */
export async function autoBookNextSlot(store: Store, c: CaseRecord): Promise<boolean> {
  const settings = await store.getAssistant();
  if (!settings.appointmentBooking || (c.fields.apptStage ?? "") !== "") return false;
  const existing = await store.listAppointments();
  const slot = findNextSlot({
    workingDays: settings.workingDays,
    customerDays: settings.workingDays,
    slotStart: settings.slotStart,
    slotEnd: settings.slotEnd,
    slotMinutes: settings.slotMinutes,
    maxAppointmentsPerDay: settings.maxAppointmentsPerDay,
    vacation: settings.vacationFrom && settings.vacationUntil ? { from: settings.vacationFrom, until: settings.vacationUntil } : null,
    existing,
  });
  if (!slot) return false;
  await store.saveAppointment({
    caseId: c.id,
    title: `Beratung ${c.customerName}`,
    startsAt: slot.toISOString(),
    durationMin: settings.slotMinutes,
    notes: "Automatisch von der KI vorgeschlagen – wartet auf Freigabe durch das Team",
    status: "proposed",
  });
  await store.updateCase(c.id, { fields: { apptStage: "proposed" } });
  await store.addEvent(c.id, "appointment", `Termin vorgeschlagen, wartet auf Freigabe: ${formatSlot(slot)}`);
  return true;
}

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
 * der Kunde schickt sie einfach als Antwort auf unsere Mail zurück, kein Upload-Link nötig. Die KI prüft,
 * ob sie tatsächlich ausgefüllt wirkt: Wirkt sie erkennbar leer/unvollständig, zählt sie NICHT als erledigt
 * (siehe checklist.ts) und der Kunde bekommt automatisch eine Mail mit der Bitte, sie erneut korrekt
 * auszufüllen – inklusive der Vorlage erneut als Anhang, damit er sie nicht erst wiederfinden muss.
 * Gibt false zurück, wenn gerade keine Vorlage für diesen Fall ausstand.
 */
/** Liefert nur die Textzeilen, die in der ausgefüllten Vorlage NEU sind gegenüber der leeren Vorlage. */
function diffNewPdfText(blankText: string, filledText: string): string {
  const blankLines = new Set(
    blankText
      .split(/\r?\n/)
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean),
  );
  return filledText
    .split(/\r?\n/)
    .filter((l) => {
      const norm = l.trim().toLowerCase();
      return norm.length > 0 && !blankLines.has(norm);
    })
    .join("\n");
}

/**
 * Anhang einer E-Mail-Antwort, der keine zurückgeschickte Büro-Vorlage ist (z. B. Grundriss, Energieausweis, Foto):
 * als Dokument des Falls ablegen. Die Art wird am Dateinamen erkannt, sonst – wenn genau ein Pflichtdokument
 * offen ist – diesem zugeordnet, sonst als Foto/"Sonstiges". Danach wird der Fall neu bewertet.
 */
export async function receiveCaseDocument(store: Store, caseId: string, bytes: Uint8Array, fileName: string): Promise<void> {
  const c = await store.getCase(caseId);
  const mime = sniffMime(bytes);
  if (!c || !mime) return;
  const name = fileName.toLowerCase();
  const guessed: DocumentKind | null = /grundriss|floorplan|bauplan/.test(name) ? "floorplan" : /energieausweis|energy/.test(name) ? "energy_certificate" : null;
  let kind: DocumentKind | null = guessed;
  if (!kind) {
    const openDocs = (await refreshCase(store, caseId, { hint: "waiting", touch: false })).checklist.missing.filter((i) => i.key.startsWith("doc:"));
    kind = openDocs.length === 1 ? (openDocs[0].key.replace("doc:", "") as DocumentKind) : mime === "application/pdf" ? "other" : "photos";
  }
  const storagePath = await saveFile({ companyId: c.companyId, caseId, bytes, mime });
  await registerUpload(store, c, { kind, fileName, mimeType: mime, size: bytes.length, storagePath });
  await refreshCase(store, caseId, { hint: "waiting" });
}

/** Normalisiert einen Dateinamen für den Vergleich: Endung weg, nur Buchstaben/Zahlen, in Wörter zerlegt. */
const normalizeFileName = (s: string) =>
  s
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Bei mehreren gleichzeitig offenen Vorlagen (z. B. Leistungs-Vorlage + "bei jeder Anfrage dabei"-Vorlage):
 * findet anhand des zurückgeschickten Dateinamens die naheliegendste erwartete Vorlage (Kunden behalten beim
 * Zurückschicken oft den Original-Dateinamen bei, ggf. mit Zusatz wie "_1_" oder "(1)"). Kein eindeutiger
 * Treffer: null, der Aufrufer fällt dann auf die erste offene Vorlage zurück.
 */
function matchPendingByFileName(pendingList: TemplateDocument[], templates: DocumentTemplate[], fileName: string): TemplateDocument | null {
  const incoming = normalizeFileName(fileName);
  if (!incoming) return null;
  let best: TemplateDocument | null = null;
  let bestScore = 0;
  for (const p of pendingList) {
    const tpl = templates.find((t) => t.id === p.templateId);
    const candidate = tpl ? normalizeFileName(tpl.fileName) : "";
    if (!candidate) continue;
    const score = incoming.includes(candidate) || candidate.includes(incoming) ? candidate.length : 0;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

export async function receiveFilledTemplate(store: Store, caseId: string, bytes: Uint8Array, fileName: string): Promise<boolean> {
  const pendingList = (await store.listTemplateDocuments(caseId)).filter((t) => t.status === "sent");
  if (!pendingList.length) return false;
  const c = await store.getCase(caseId);
  if (!c) return false;

  const storagePath = await saveFile({ companyId: c.companyId, caseId, bytes, mime: "application/pdf" });
  const text = await extractPdfText(bytes.slice());
  const templates = await store.listDocumentTemplates();
  // Mehrere offene Vorlagen gleichzeitig (z. B. Leistungs-Vorlage UND "bei jeder Anfrage dabei"-Vorlage):
  // nicht blind die erste nehmen, sonst wird ein zurückgeschicktes Dokument der FALSCHEN erwarteten Vorlage
  // zugeordnet. Stattdessen anhand des zurückgeschickten Dateinamens die naheliegendste Vorlage auswählen.
  const pending = pendingList.length > 1 ? (matchPendingByFileName(pendingList, templates, fileName) ?? pendingList[0]) : pendingList[0];
  const template = templates.find((t) => t.id === pending.templateId);
  const title = template?.title ?? fileName;
  // Leere Original-Vorlage einmal lesen: Der Unterschied zum zurückgeschickten Dokument zeigt der Prüfung, was der
  // Kunde wirklich eingetragen hat (sonst rät die KI nur anhand des Gesamttextes, ob etwas fehlt).
  const blank = template ? await readFile(template.storagePath) : null;
  const blankText = blank ? await extractPdfText(blank.bytes.slice()) : "";
  const newText = diffNewPdfText(blankText, text);
  const { filled, wrongDocument, note } = text ? await verifyFilledTemplate(title, text, newText) : { filled: null, wrongDocument: false, note: "" };

  await store.saveTemplateDocument({ id: pending.id, caseId, templateId: pending.templateId, status: "received", storagePath, aiNote: note, filled: wrongDocument ? false : filled, receivedAt: new Date().toISOString() });
  await store.addEvent(caseId, "document", note ? `Vorlage per E-Mail zurückerhalten: ${title} (${note})` : `Vorlage per E-Mail zurückerhalten: ${title}`);

  if (wrongDocument || filled === false) {
    const requestText = wrongDocument
      ? `Vielen Dank für Ihre Rückmeldung. ${note || "Das zurückgeschickte Dokument scheint nicht die erwartete Vorlage zu sein."} Bitte schicken Sie uns stattdessen das Formular „${title}“ (im Anhang) ausgefüllt als Antwort auf diese E-Mail zurück.`
      : note
        ? `Vielen Dank für die zurückgeschickte Vorlage „${title}“. Beim Prüfen ist uns aufgefallen: ${note} Bitte füllen Sie das Formular (im Anhang) vollständig aus und schicken Sie es uns erneut als Antwort auf diese E-Mail mit dem ausgefüllten Dokument als Anhang zurück.`
        : `Vielen Dank für die zurückgeschickte Vorlage „${title}“. Sie wirkt noch nicht vollständig ausgefüllt. Bitte füllen Sie das Formular (im Anhang) vollständig aus und schicken Sie es uns erneut als Antwort auf diese E-Mail mit dem ausgefüllten Dokument als Anhang zurück.`;
    const attachments: InboundAttachment[] = [];
    if (template) {
      const blank = await readFile(template.storagePath);
      if (blank) attachments.push({ filename: template.fileName, mime: "application/pdf", bytes: blank.bytes });
    }
    const result = await deliverToCustomer({ companyId: c.companyId, channel: "email", email: c.fields.email, phone: c.fields.phone, text: requestText, attachments });
    await store.addMessage(caseId, "assistant", requestText, { channel: "email", delivery: result.delivered ? "delivered" : "not_sent" });
    await refreshCase(store, caseId, { hint: "waiting" });
    return true;
  }

  // Richtige, ausgefüllte Vorlage: Angaben, die der Kunde neu in die Vorlage eingetragen hat, zusätzlich für
  // offene Pflichtfragen übernehmen (z. B. Baujahr steht sowohl im Frage-Flow als auch im Formular). Dabei
  // wird NUR der Unterschied zur leeren Vorlage betrachtet, damit vom Büro selbst vorausgefüllter Text
  // (Briefkopf, Textbausteine …) nicht versehentlich als Kundenangabe übernommen wird.
  if (template && newText.trim()) {
    const { fields: extracted } = await extractFields(newText);
    const questions = await store.listQuestions();
    const merged = { ...c.fields };
    if (mergeExtracted(merged, extracted, { allowFreeText: false }, questions).length) {
      await store.updateCase(caseId, { fields: merged, keepTimestamp: true });
    }
  }

  // receiveFilledTemplate läuft NACH der normalen Gesprächsverarbeitung (siehe mail-sync.ts), zu deren
  // Zeitpunkt die Vorlage noch als "sent" galt; die KI konnte den Fall also in diesem Zug noch nicht als
  // fertig erkennen – das muss hier nachgeholt werden, sonst bleibt die Abschluss-Nachricht ganz aus.
  const refreshed = await refreshCase(store, caseId, { hint: "waiting" });
  if (refreshed.becamePrepared) {
    const serviceMessages = await store.listServiceMessages();
    const completionText = serviceMessages.find((m) => m.service === c.fields.service)?.appointmentNote?.trim() || "Vielen Dank, damit haben wir alle Angaben. Ein Mitarbeiter meldet sich bei Ihnen.";
    // Auch per E-Mail direkt einen freien Termin in den Kalender eintragen – aber nur, wenn dadurch
    // wirklich NICHTS mehr offen ist (nicht nur die Vorlage, sondern auch sonstige Pflichtdokumente wie
    // Grundriss/Energieausweis), sonst würde der Termin schon vor Vollständigkeit gebucht.
    const booked = refreshed.checklist.missing.length === 0 && (await autoBookNextSlot(store, refreshed.caseRecord));
    const text = booked ? `${completionText} ${appointmentPendingReviewText}` : completionText;
    const result = await deliverToCustomer({ companyId: c.companyId, channel: "email", email: c.fields.email, phone: c.fields.phone, text });
    await store.addMessage(caseId, "assistant", text, { channel: "email", delivery: result.delivered ? "delivered" : "not_sent" });
  }
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


/**
 * Berechnet Vollständigkeit, Status und Zusammenfassung eines Falls neu und hält Follow-ups aktuell.
 * Wird nach jeder Änderung aufgerufen (Chat-Nachricht, Upload, Bearbeitung, Notiz).
 */
export async function refreshCase(store: Store, caseId: string, opts: RefreshOptions = {}): Promise<RefreshResult> {
  const [current, questions, settings, company, templateDocs, templates, serviceMessages] = await Promise.all([
    store.getCase(caseId),
    store.listQuestions(),
    store.getAssistant(),
    store.getCompany(),
    store.listTemplateDocuments(caseId),
    store.listDocumentTemplates(),
    store.listServiceMessages(),
  ]);
  if (!current) throw new Error("Fall nicht gefunden");

  let c = current;
  let documents = await store.listDocuments(caseId);
  const derived = deriveFields(c.fields);
  const fields = { ...c.fields, ...derived };
  const foerderOverrides = { energyCertificate: company.foerderEnergyCertificate, floorplan: company.foerderFloorplan };
  const templateTitleById = new Map(templates.map((t) => [t.id, t.title]));
  const templateSends = templateDocs.map((td) => ({ id: td.id, title: templateTitleById.get(td.templateId) ?? "Vorlage", status: td.status, filled: td.filled }));
  // Frage-Flow ist eine reine Website-Chat-Funktion: Bei E-Mail-Fällen fragt die KI nichts davon aktiv ab
  // (siehe engine.ts), deshalb dürfen diese Felder dort auch nicht als "fehlend" die Vollständigkeit blockieren.
  const includeFields = c.source !== "email";
  let checklist = buildChecklist({ questions, fields, documents, foerderOverrides, serviceMessages, templateSends, includeFields });

  let requestedNow: DocumentKind[] = [];
  let uploadLink: string | null = null;
  if (opts.autoRequestDocs && settings.autoFollowUp && checklist.dataComplete && checklist.unrequestedDocuments.length > 0) {
    const kinds = checklist.unrequestedDocuments.filter((i) => i.key.startsWith("doc:")).map((i) => i.key.replace("doc:", "") as DocumentKind);
    if (kinds.length) {
      const res = await requestDocuments(store, c, kinds);
      requestedNow = res.requested;
      uploadLink = res.url;
      documents = await store.listDocuments(caseId);
      checklist = buildChecklist({ questions, fields, documents, foerderOverrides, serviceMessages, templateSends, includeFields });
      c = (await store.getCase(caseId)) ?? c;
    }
  }

  const previous = c.status;
  const status = deriveStatus(previous, checklist, opts.hint);
  // "Vorbereitet" heißt: wirklich alles liegt vor (READY_FOR_REVIEW). Alte Fälle mit dem früheren Zwischenstatus
  // COMPLETE zählen beim Übergang ebenfalls als neu vorbereitet.
  const becamePrepared = status === "READY_FOR_REVIEW" && previous !== "READY_FOR_REVIEW" && previous !== "CONVERTED";

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
  return { caseRecord: result, checklist, documents, requestedNow, uploadLink, becamePrepared };
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

  const settings = await store.getAssistant();
  const text = appointmentConfirmedText(new Date(saved.startsAt), settings.appointmentConfirmedTemplate);
  const channel = "email" as const;
  const result = await deliverToCustomer({ companyId: c.companyId, channel, email: c.fields.email, phone: c.fields.phone, text, subject: "Ihr Beratungstermin" });
  await store.addMessage(c.id, "staff", text, { channel, delivery: result.delivered ? "delivered" : "not_sent" });

  return { ok: true, appointment: saved, delivered: result.delivered, reason: result.reason };
}
