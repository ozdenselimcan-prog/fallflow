import { randomBytes } from "node:crypto";
import { extractFromFilledForm } from "@/lib/ai/form-extractor";
import { mergeExtracted } from "@/lib/ai/conversation";
import { FORM_ENTRIES_KEY, mergeFormEntries } from "@/lib/cases/form-entries";
import { ATTENTION_KEY, attentionOf } from "@/lib/cases/attention";
import { inspectFilledPdf, type VisualInspection } from "@/lib/ai/inspect-filled-pdf";
import { getAiProvider } from "@/lib/ai/provider";
import { summarizeCase } from "@/lib/ai/summary";
import { customerFacingNote } from "@/lib/ai/customer-note";
import { verifyFilledTemplate } from "@/lib/ai/verify-filled-template";
import { buildSummary } from "@/lib/cases/completeness";
import { DOCUMENT_LABELS, STATUS_LABELS } from "@/lib/cases/fields";
import { siteConfig } from "@/lib/config/site";
import type { Store } from "@/lib/data/store";
import type { Appointment, CaseDocument, CaseRecord, DocumentKind, DocumentTemplate, MessageChannel, ServiceMessage, TemplateDocument } from "@/lib/data/types";
import { extractPdfText } from "@/lib/documents/pdf-text";
import { readFile, saveFile, sniffMime, type AllowedMime } from "@/lib/documents/storage";
import type { InboundAttachment } from "@/lib/integrations/email";
import { deliverToCustomer } from "@/lib/integrations/outbound";
import { officeAlreadyRequests } from "./document-mentions";
import { notifyOffice } from "./notify";
import { buildChecklist, deriveFields, deriveStatus, documentRequirements, type Checklist, type StatusHint } from "./checklist";
import { appointmentAddonText, appointmentConfirmedText, findNextSlot, formatSlot } from "./scheduling";

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
  const sentIds = uniqueTemplates.length ? new Set((await store.listTemplateDocuments(c.id)).map((td) => td.templateId)) : new Set<string>();
  const pending = uniqueTemplates.filter((t) => !sentIds.has(t.id));

  if (channel !== "email") return matchServiceMaterialsLink(store, c, pending, serviceMessages, service);

  // E-Mail: alles in EINER Nachricht – eigene Nachricht des Büros zur Leistung (sonst ein kurzer Standardtext),
  // Hinweis auf die angehängten Formulare und die benötigten Unterlagen (Grundriss/Energieausweis), damit der
  // Kunde von Anfang an weiß, was er schicken soll.
  const introDue = Boolean(service) && c.fields.serviceMessageSentFor !== service;
  if (!pending.length && !introDue) return null;
  const own = serviceMessages.find((m) => m.service === service)?.body.trim() ?? "";

  const attachments: InboundAttachment[] = [];
  const titles: string[] = [];
  const infoTitles: string[] = [];
  for (const tpl of pending) {
    // Erst die Datei laden und NUR bei Erfolg als "gesendet" markieren bzw. im Text behaupten, sie liege
    // im Anhang – sonst würde bei einem Speicherfehler eine Vorlage als erledigt gelten, obwohl beim
    // Kunden nie ein Anhang ankam (und die KI es dann auch nie erneut versucht).
    const file = await readFile(tpl.storagePath);
    if (!file) {
      await store.addEvent(c.id, "document", `Vorlage „${tpl.title}“ konnte nicht aus dem Speicher geladen werden – bitte unter Vorlagen & Nachrichten erneut hochladen.`);
      continue;
    }
    // Nur-Info-Vorlagen (Preisliste, Datenschutzhinweis …) werden mitgeschickt, aber nicht zurückerwartet.
    const infoOnly = tpl.requiresReturn === false;
    await store.saveTemplateDocument({ caseId: c.id, templateId: tpl.id, status: infoOnly ? "info" : "sent", storagePath: "", aiNote: "", receivedAt: null });
    attachments.push({ filename: tpl.fileName, mime: "application/pdf", bytes: file.bytes });
    (infoOnly ? infoTitles : titles).push(tpl.title);
    await store.addEvent(c.id, "document", infoOnly ? `Dokument zur Information an Kunden gesendet: ${tpl.title}` : `Vorlage automatisch an Kunden gesendet: ${tpl.title}`);
  }
  if (!introDue && !titles.length && !infoTitles.length) return null;

  const parts: string[] = [];
  if (introDue) parts.push(own || `Vielen Dank für Ihre Anfrage zur Leistung „${service}“.`);
  // Erwähnt das Büro den Anhang schon selbst ("Anbei unser Formular …"), den eigenen Hinweis nicht doppelt anhängen:
  // nur noch kurz sagen, wie es zurückgeschickt wird – bzw. gar nichts, wenn auch das schon drinsteht.
  const ownMentionsAttachment = introDue && /\banbei\b|im anhang|beigefügt|angehängt|anhängend/i.test(own);
  const ownMentionsReturn = introDue && /zurück(zu)?(senden|schicken)|(senden|schicken|mailen)\b[^.!?]{0,40}\bzurück|antwort auf diese/i.test(own);
  if (titles.length && ownMentionsAttachment) {
    if (!ownMentionsReturn) parts.push(`Bitte senden Sie ${titles.length === 1 ? "das ausgefüllte Formular" : "die ausgefüllten Formulare"} einfach als Antwort auf diese E-Mail zurück.`);
  } else if (titles.length === 1) {
    parts.push(`Im Anhang finden Sie das Formular „${titles[0]}“ – bitte ausfüllen und einfach als Antwort auf diese E-Mail mit dem ausgefüllten Dokument als Anhang zurücksenden.`);
  } else if (titles.length > 1) {
    parts.push(`Im Anhang finden Sie folgende Formulare: ${titles.map((t) => `„${t}“`).join(", ")} – bitte ausfüllen und einfach als Antwort auf diese E-Mail mit den ausgefüllten Dokumenten als Anhang zurücksenden.`);
  }
  if (infoTitles.length && !(ownMentionsAttachment && !titles.length)) {
    const list = infoTitles.map((t) => `„${t}“`).join(", ");
    parts.push(`Zu Ihrer Information finden Sie außerdem ${infoTitles.length === 1 ? `das Dokument ${list}` : `die Dokumente ${list}`} im Anhang – ${infoTitles.length === 1 ? "es muss" : "sie müssen"} nicht zurückgeschickt werden.`);
  }
  if (introDue) {
    const company = await store.getCompany();
    const documents = await store.listDocuments(c.id);
    const needed = documentRequirements(c.fields, { energyCertificate: company.foerderEnergyCertificate, floorplan: company.foerderFloorplan }, serviceMessages)
      .filter((r) => r.required && !documents.some((d) => d.kind === r.kind && d.status === "received"));
    // Was das Büro in seiner eigenen Nachricht schon selbst anfordert (auch als "Baupläne", "Energiepass" …), nicht
    // noch einmal aufzählen.
    const unmentioned = needed.filter((r) => !officeAlreadyRequests(own, r.kind)).map((r) => DOCUMENT_LABELS[r.kind]);
    if (unmentioned.length) parts.push(`Damit wir Ihre Anfrage bearbeiten können, schicken Sie uns bitte außerdem: ${unmentioned.join(", ")} – gern als PDF oder Foto, einfach als Antwort auf diese E-Mail.`);
    await store.updateCase(c.id, { fields: { serviceMessageSentFor: service } });
    await store.addEvent(c.id, "document", `Nachricht automatisch an Kunden gesendet (${service})`);
  }
  return { texts: [parts.join("\n\n")], attachments };
}

/** Nicht-E-Mail-Kanäle: Vorlagen als Download-Link statt Anhang (je Vorlage ein Hinweis). */
async function matchServiceMaterialsLink(
  store: Store,
  c: CaseRecord,
  pending: DocumentTemplate[],
  serviceMessages: ServiceMessage[],
  service: string,
): Promise<{ texts: string[]; attachments: InboundAttachment[] } | null> {
  const texts: string[] = [];
  for (const tpl of pending) {
    const customMessage = serviceMessages.find((m) => m.service === tpl.service)?.body.trim();
    await store.saveTemplateDocument({ caseId: c.id, templateId: tpl.id, status: tpl.requiresReturn === false ? "info" : "sent", storagePath: "", aiNote: "", receivedAt: null });
    const token = await ensureUploadToken(store, c);
    const downloadUrl = `${siteConfig.appUrl}/api/upload/${token}/template/${tpl.id}`;
    texts.push(
      customMessage
        ? `${customMessage}\n\nDokument herunterladen: ${downloadUrl}. Bitte ausgefüllt per E-Mail an uns zurücksenden.`
        : `Für Ihr Anliegen („${tpl.title}“) laden Sie sich bitte das Dokument herunter: ${downloadUrl}. Bitte ausgefüllt per E-Mail an uns zurücksenden.`,
    );
    await store.addEvent(c.id, "document", `Vorlage automatisch an Kunden gesendet: ${tpl.title}`);
  }
  if (texts.length) return { texts, attachments: [] };
  if (service && c.fields.serviceMessageSentFor !== service) {
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
  let kind: DocumentKind | null = guessDocumentKind(fileName);
  if (!kind) {
    const openDocs = (await refreshCase(store, caseId, { hint: "waiting", touch: false })).checklist.missing.filter((i) => i.key.startsWith("doc:"));
    kind = openDocs.length === 1 ? (openDocs[0].key.replace("doc:", "") as DocumentKind) : mime === "application/pdf" ? "other" : "photos";
  }
  const storagePath = await saveFile({ companyId: c.companyId, caseId, bytes, mime });
  await registerUpload(store, c, { kind, fileName, mimeType: mime, size: bytes.length, storagePath });
  await refreshCase(store, caseId, { hint: "waiting" });
}

export const SKIPPED_ATTACHMENTS_KEY = "skippedAttachments";

/**
 * Anhänge, die nicht übernommen werden konnten (z. B. HEIC-Fotos, Word-Dateien, über 10 MB): Das Büro bekommt in der
 * Fallakte den Hinweis, selbst im Postfach nachzusehen. Die Dateinamen werden gesammelt (eine Zeile je Datei).
 */
export async function noteSkippedAttachments(store: Store, caseId: string, fileNames: string[]): Promise<void> {
  const c = await store.getCase(caseId);
  if (!c || !fileNames.length) return;
  const known = (c.fields[SKIPPED_ATTACHMENTS_KEY] ?? "").split("\n").filter(Boolean);
  const merged = [...new Set([...known, ...fileNames.map((n) => n.replace(/[\r\n]+/g, " ").slice(0, 120))])].slice(-30);
  await store.updateCase(caseId, { fields: { ...c.fields, [SKIPPED_ATTACHMENTS_KEY]: merged.join("\n") }, keepTimestamp: true });
  await store.addEvent(caseId, "document", `Kunde hat Dateien geschickt, die nicht übernommen werden konnten (${fileNames.join(", ")}) – bitte selbst im Postfach ansehen.`);
}

/**
 * Anteil der Wörter der leeren Vorlage, die auch im zurückgeschickten Dokument stehen (0–1). Ein vom Kunden
 * ausgefülltes Formular enthält den Vordruck praktisch vollständig – daran ist die richtige Vorlage verlässlich zu
 * erkennen (die KI ließ sich sonst z. B. vom Büronamen "… Energieberatung" im Briefkopf irritieren).
 * null = leere Vorlage hat zu wenig Text für einen Vergleich.
 */
export function templateSimilarity(blankText: string, text: string): number | null {
  const words = (s: string) => new Set(s.toLowerCase().match(/[a-zäöüß]{4,}/g) ?? []);
  const blankWords = words(blankText);
  if (blankWords.size < 4) return null;
  const filledWords = words(text);
  let hits = 0;
  for (const w of blankWords) if (filledWords.has(w)) hits++;
  return hits / blankWords.size;
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

export async function receiveFilledTemplate(
  store: Store,
  caseId: string,
  bytes: Uint8Array,
  fileName: string,
  /** pendingId: diese offene Vorlage verwenden (statt sie selbst zu suchen); quiet: keine Abschluss-Nachricht, das übernimmt der Aufrufer;
   * mime: abfotografiertes Formular (Bild) statt PDF; visual: bereits erfolgte Sichtprüfung wiederverwenden. */
  opts: { pendingId?: string; quiet?: boolean; mime?: AllowedMime; visual?: VisualInspection } = {},
): Promise<boolean> {
  const pendingList = (await store.listTemplateDocuments(caseId)).filter((t) => t.status === "sent");
  if (!pendingList.length) return false;
  const c = await store.getCase(caseId);
  if (!c) return false;

  const mime: AllowedMime = opts.mime ?? "application/pdf";
  const storagePath = await saveFile({ companyId: c.companyId, caseId, bytes, mime });
  const text = mime === "application/pdf" ? await extractPdfText(bytes.slice()) : "";
  const templates = await store.listDocumentTemplates();
  // Mehrere offene Vorlagen gleichzeitig (z. B. Leistungs-Vorlage UND "bei jeder Anfrage dabei"-Vorlage):
  // nicht blind die erste nehmen, sonst wird ein zurückgeschicktes Dokument der FALSCHEN erwarteten Vorlage
  // zugeordnet. Stattdessen anhand des zurückgeschickten Dateinamens die naheliegendste Vorlage auswählen – und
  // passt kein Dateiname, anhand des Inhalts (welche leere Vorlage steckt im Dokument).
  const blankTextOf = async (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    const file = tpl ? await readFile(tpl.storagePath) : null;
    return file ? await extractPdfText(file.bytes.slice()) : "";
  };
  const forced = opts.pendingId ? pendingList.find((p) => p.id === opts.pendingId) : undefined;
  let pending = forced ?? (pendingList.length > 1 ? matchPendingByFileName(pendingList, templates, fileName) : pendingList[0]);
  if (!pending) {
    let best = { score: -1, item: pendingList[0] };
    for (const p of pendingList) {
      const score = text ? (templateSimilarity(await blankTextOf(p.templateId), text) ?? 0) : 0;
      if (score > best.score) best = { score, item: p };
    }
    pending = best.item;
  }
  const template = templates.find((t) => t.id === pending.templateId);
  const title = template?.title ?? fileName;
  // Leere Original-Vorlage einmal lesen: Der Unterschied zum zurückgeschickten Dokument zeigt der Prüfung, was der
  // Kunde wirklich eingetragen hat (sonst rät die KI nur anhand des Gesamttextes, ob etwas fehlt).
  const blankText = await blankTextOf(pending.templateId);
  const newText = diffNewPdfText(blankText, text);
  // Enthält das Dokument den Vordruck der Vorlage fast vollständig, ist es sicher die richtige Vorlage.
  const similarity = text ? templateSimilarity(blankText, text) : null;
  const sameTemplate = similarity !== null && similarity >= 0.6;
  const textVerdict = text ? await verifyFilledTemplate(title, text, newText, sameTemplate) : null;
  // Steckt (fast) kein auslesbarer Text des Kunden im PDF (Scan, Foto, Handschrift, Stift auf dem Tablet) oder hält
  // die Text-Prüfung das Formular für leer/falsch, sieht sich die KI die Seiten selbst an – wie ein Mensch.
  const customerText = newText.replace(/\[Unterschrift\/Handzeichen vorhanden\]/g, "").trim();
  const needsVisual = !text || customerText.length < 25 || textVerdict?.filled === false || Boolean(textVerdict?.wrongDocument && !sameTemplate);
  const visual = opts.visual ?? (needsVisual ? await inspectFilledPdf(title, bytes, fileName, mime) : null);
  let filled: boolean | null;
  let wrongDocument: boolean;
  let note: string;
  if (visual) {
    wrongDocument = visual.wrongDocument && !sameTemplate;
    filled = wrongDocument ? false : visual.filled;
    note = wrongDocument || !visual.filled ? visual.note : "";
  } else if (textVerdict) {
    wrongDocument = textVerdict.wrongDocument && !sameTemplate;
    filled = textVerdict.filled;
    note = textVerdict.wrongDocument && sameTemplate ? "" : textVerdict.note;
  } else {
    wrongDocument = false;
    filled = null;
    note = "";
  }
  // Der Hinweis geht wörtlich an den Kunden – nie technische Feldnamen (type, floors …) durchlassen.
  note = note ? customerFacingNote(note) : "";
  // Konnte die KI das Formular nicht selbst ansehen, obwohl es nötig gewesen wäre, ist das Ergebnis unsicher: dann
  // bekommt der Kunde KEINE automatische Beanstandung – das Büro schaut kurz selbst drauf.
  // (Ohne eingerichtete KI gibt es keine Sichtprüfung – dann bleibt es beim bisherigen Verhalten.)
  const uncertain = needsVisual && !visual && getAiProvider() !== null;

  await store.saveTemplateDocument({ id: pending.id, caseId, templateId: pending.templateId, status: "received", storagePath, aiNote: note, filled: wrongDocument ? false : filled, receivedAt: new Date().toISOString() });
  await store.addEvent(caseId, "document", note ? `Vorlage per E-Mail zurückerhalten: ${title} (${note})` : `Vorlage per E-Mail zurückerhalten: ${title}`);
  // Die ausgefüllte PDF auch als Dokument in der Fallakte ablegen, damit das Büro sie dort öffnen/herunterladen kann.
  await registerUpload(store, c, { kind: "other", fileName: `${title} (vom Kunden) – ${fileName}`, mimeType: mime, size: bytes.length, storagePath });

  // Angaben, die der Kunde ins Formular eingetragen hat (Adresse, PLZ, Gebäudetyp, Baujahr, Wohnfläche,
  // Eigentümer …), in die Fallakte übernehmen – nur die vom Kunden eingetragenen, nicht den Vordruck des Büros.
  // Auch bei einer nur teilweise ausgefüllten Vorlage, damit schon Vorhandenes nicht verloren geht.
  if (!wrongDocument && (visual || text)) {
    const extracted = visual ? visual.extraction : await extractFromFilledForm(blankText, text, newText);
    const questions = await store.listQuestions();
    const merged = { ...c.fields };
    const added = mergeExtracted(merged, extracted.fields, { allowFreeText: false }, questions);
    const entries = mergeFormEntries(merged[FORM_ENTRIES_KEY], extracted.entries, Object.values(merged));
    if (added.length || entries !== (merged[FORM_ENTRIES_KEY] ?? "")) {
      if (entries) merged[FORM_ENTRIES_KEY] = entries;
      await store.updateCase(caseId, { fields: merged, keepTimestamp: true });
      c.fields = merged;
    }
  }

  // Unsicheres Ergebnis (Formular nicht lesbar bzw. Beanstandung ohne Sichtprüfung): Büro entscheidet.
  if (uncertain && (wrongDocument || filled !== true) && !attentionOf(c.fields)) {
    const reason = note ? `Formular „${title}“ bitte selbst prüfen – ${note.replace(/[.?!]+$/, "")}` : `Formular „${title}“ konnte nicht automatisch gelesen werden – bitte selbst prüfen`;
    await store.updateCase(caseId, { fields: { [ATTENTION_KEY]: reason }, keepTimestamp: true });
    c.fields = { ...c.fields, [ATTENTION_KEY]: reason };
    await store.addEvent(caseId, "handoff", `Aufmerksamkeit benötigt (${reason}) – keine automatische Antwort an den Kunden.`);
  }

  // "Automatische Antworten" aus: Formular ist abgelegt, geprüft und ausgelesen – geschrieben wird dem Kunden nichts.
  if (!(await store.getAssistant()).autoReply) {
    await refreshCase(store, caseId, { hint: "waiting" });
    return true;
  }
  // Wartet der Fall auf eine persönliche Antwort des Energieberaters ("Aufmerksamkeit benötigt"), schreibt die KI
  // dem Kunden nichts automatisch – die PDF ist trotzdem abgelegt und geprüft.
  if ((wrongDocument || filled !== true) && attentionOf(c.fields)) {
    await refreshCase(store, caseId, { hint: "waiting" });
    return true;
  }
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
    const result = await deliverToCustomer({ companyId: c.companyId, channel: "email", email: c.fields.email, phone: c.fields.phone, text: requestText, attachments, subject: await emailSubjectFor(store, c.fields.service) });
    await store.addMessage(caseId, "assistant", requestText, { channel: "email", delivery: result.delivered ? "delivered" : "not_sent" });
    await refreshCase(store, caseId, { hint: "waiting" });
    return true;
  }

  // receiveFilledTemplate läuft NACH der normalen Gesprächsverarbeitung (siehe mail-sync.ts), zu deren
  // Zeitpunkt die Vorlage noch als "sent" galt; die KI konnte den Fall also in diesem Zug noch nicht als
  // fertig erkennen – das muss hier nachgeholt werden, sonst bleibt die Abschluss-Nachricht ganz aus.
  const refreshed = await refreshCase(store, caseId, { hint: "waiting" });
  if (refreshed.becamePrepared && !opts.quiet && !attentionOf(refreshed.caseRecord.fields)) await sendCompletionMessage(store, refreshed);
  return true;
}

/** Eigener Betreff des Büros für automatische E-Mails zu dieser Leistung (undefined = Standardbetreff). */
export async function emailSubjectFor(store: Store, service: string | undefined): Promise<string | undefined> {
  const serviceMessages = await store.listServiceMessages();
  return serviceMessages.find((m) => m.service === service)?.subject?.trim() || undefined;
}

/** Text der Abschluss-Nachricht: eigener Text des Büros für diese Leistung, sonst Standard. */
export async function completionTextFor(store: Store, service: string | undefined, opts: { appointmentProposed?: boolean } = {}): Promise<string> {
  const serviceMessages = await store.listServiceMessages();
  const own = serviceMessages.find((m) => m.service === service)?.appointmentNote?.trim();
  if (opts.appointmentProposed) return own ? `${own} ${appointmentAddonText}` : `Vielen Dank, damit haben wir alle Angaben. ${appointmentAddonText}`;
  return own || "Vielen Dank, damit haben wir alle Angaben. Ein Mitarbeiter meldet sich bei Ihnen.";
}

/**
 * Schickt per E-Mail die Abschluss-Nachricht, sobald ein Fall wirklich vollständig geworden ist, und trägt
 * dabei direkt einen freien Termin als Vorschlag in den Kalender ein (siehe autoBookNextSlot).
 */
export async function sendCompletionMessage(store: Store, refreshed: RefreshResult): Promise<void> {
  // "Automatische Antworten" aus: keine Abschluss-Mail und kein automatischer Terminvorschlag – das Büro meldet sich selbst.
  if (!(await store.getAssistant()).autoReply) return;
  const c = refreshed.caseRecord;
  const booked = refreshed.checklist.missing.length === 0 && (await autoBookNextSlot(store, c));
  const text = await completionTextFor(store, c.fields.service, { appointmentProposed: booked });
  const result = await deliverToCustomer({ companyId: c.companyId, channel: "email", email: c.fields.email, phone: c.fields.phone, text, subject: await emailSubjectFor(store, c.fields.service) });
  await store.addMessage(c.id, "assistant", text, { channel: "email", delivery: result.delivered ? "delivered" : "not_sent" });
}

/** Erkennt die Dokumentart am Dateinamen (null = nicht eindeutig). */
function guessDocumentKind(fileName: string): DocumentKind | null {
  const name = fileName.toLowerCase();
  if (/grundriss|floorplan|bauplan/.test(name)) return "floorplan";
  if (/energieausweis|energy/.test(name)) return "energy_certificate";
  return null;
}

/**
 * Verarbeitet alle Anhänge EINER Kunden-E-Mail gemeinsam und antwortet danach genau einmal:
 * - Anhänge, deren Dateiname zu einer offenen Büro-Vorlage passt, werden als ausgefüllte Vorlage geprüft.
 * - Anhänge, die nach Grundriss/Energieausweis heißen oder Fotos sind, werden als Dokument des Falls abgelegt.
 * - Übrige PDFs gehen an eine noch offene Vorlage (falls eine offen ist), sonst als Dokument.
 * Danach: Ist der Fall vollständig → Abschluss-Nachricht (+ Terminvorschlag). Fehlt noch etwas und wurde
 * nichts beanstandet → kurze Bestätigung mit dem, was noch fehlt (sonst hört der Kunde gar nichts).
 */
export async function receiveEmailAttachments(store: Store, caseId: string, attachments: InboundAttachment[]): Promise<void> {
  if (!attachments.length) return;
  const templates = await store.listDocumentTemplates();
  const before = await store.getCase(caseId);
  if (!before) return;
  const previousStatus = before.status;
  let rejected = false;

  // Zuerst alle Anhänge, die eindeutig einer offenen Vorlage zugeordnet werden können – damit ein ebenfalls
  // mitgeschickter Grundriss nicht fälschlich als Vorlage geprüft wird.
  const rest: InboundAttachment[] = [];
  for (const att of attachments) {
    const pendingList = (await store.listTemplateDocuments(caseId)).filter((t) => t.status === "sent");
    const match = att.mime === "application/pdf" && pendingList.length ? matchPendingByFileName(pendingList, templates, att.filename) : null;
    if (match) {
      await receiveFilledTemplate(store, caseId, att.bytes, att.filename, { pendingId: match.id, quiet: true });
      const doc = (await store.listTemplateDocuments(caseId)).find((t) => t.id === match.id);
      if (doc?.filled === false) rejected = true;
    } else rest.push(att);
  }
  for (const att of rest) {
    const pendingList = (await store.listTemplateDocuments(caseId)).filter((t) => t.status === "sent");
    if (att.mime === "application/pdf" && !guessDocumentKind(att.filename) && pendingList.length) {
      // Welche offene Vorlage es ist, entscheidet receiveFilledTemplate anhand des Inhalts.
      await receiveFilledTemplate(store, caseId, att.bytes, att.filename, { quiet: true });
      const pendingIds = new Set(pendingList.map((p) => p.id));
      const doc = (await store.listTemplateDocuments(caseId)).find((t) => pendingIds.has(t.id) && t.status === "received");
      if (doc?.filled === false) rejected = true;
    } else if (att.mime.startsWith("image/") && !guessDocumentKind(att.filename) && pendingList.length) {
      // Foto vom Handy: Ist es das abfotografierte, ausgefüllte Formular? Nur dann als Vorlage werten – sonst ganz
      // normal als Foto ablegen (z. B. ein Bild vom Heizungskeller), ohne den Kunden zu beanstanden.
      const tpl = templates.find((t) => t.id === pendingList[0].templateId);
      const imageMime = sniffMime(att.bytes);
      const visual = tpl && imageMime && imageMime !== "application/pdf" ? await inspectFilledPdf(tpl.title, att.bytes, att.filename, imageMime) : null;
      if (visual && !visual.wrongDocument && imageMime) {
        await receiveFilledTemplate(store, caseId, att.bytes, att.filename, { quiet: true, pendingId: pendingList[0].id, mime: imageMime, visual });
        if (!visual.filled) rejected = true;
      } else {
        await receiveCaseDocument(store, caseId, att.bytes, att.filename);
        // Sichtprüfung nicht möglich (z. B. KI kurz überlastet): Es könnte das abfotografierte Formular sein – dann
        // nicht automatisch "fehlt noch …" schreiben, sondern das Büro kurz draufschauen lassen.
        if (!visual && tpl && getAiProvider()) {
          const reason = `Kunde hat ein Foto geschickt (${att.filename}) – evtl. das ausgefüllte Formular „${tpl.title}“, bitte selbst prüfen`;
          await store.updateCase(caseId, { fields: { [ATTENTION_KEY]: reason }, keepTimestamp: true });
          await store.addEvent(caseId, "handoff", `Aufmerksamkeit benötigt (${reason}).`);
        }
      }
    } else {
      await receiveCaseDocument(store, caseId, att.bytes, att.filename);
    }
  }

  const refreshed = await refreshCase(store, caseId, { hint: "waiting" });
  // "Aufmerksamkeit benötigt" bzw. automatische Antworten aus: Dateien sind abgelegt, aber der Energieberater antwortet selbst.
  if (attentionOf(refreshed.caseRecord.fields) || !(await store.getAssistant()).autoReply) return;
  const nowPrepared = refreshed.caseRecord.status === "READY_FOR_REVIEW" && previousStatus !== "READY_FOR_REVIEW" && previousStatus !== "CONVERTED";
  if (nowPrepared) {
    await sendCompletionMessage(store, refreshed);
    return;
  }
  // Beanstandete Vorlagen haben bereits eine eigene Nachricht bekommen (falsches Dokument / unvollständig).
  if (rejected || refreshed.caseRecord.status === "READY_FOR_REVIEW") return;
  const stillMissing = refreshed.checklist.missing.map((i) => i.label);
  if (!stillMissing.length) return;
  const c = refreshed.caseRecord;
  const text = `Vielen Dank, Ihre Unterlagen sind bei uns angekommen. Damit wir Ihre Anfrage abschließen können, fehlt uns noch: ${stillMissing.join(", ")}. Sie können uns das einfach als Antwort auf diese E-Mail schicken.`;
  const result = await deliverToCustomer({ companyId: c.companyId, channel: "email", email: c.fields.email, phone: c.fields.phone, text, subject: await emailSubjectFor(store, c.fields.service) });
  await store.addMessage(c.id, "assistant", text, { channel: "email", delivery: result.delivered ? "delivered" : "not_sent" });
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
  // "Aufmerksamkeit benötigt": Das Büro ist am Zug (eigener Status statt "Wartet auf Kunde").
  const status = attentionOf(c.fields) && previous !== "CONVERTED" ? "NEEDS_REPLY" : deriveStatus(previous, checklist, opts.hint);
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
  // Büro per E-Mail informieren, damit nichts im Dashboard liegen bleibt – nur bei Anfragen, die per E-Mail kamen
  // (manuelle Fälle legt das Büro selbst an), und nur beim Wechsel in den jeweiligen Status.
  if (result.source === "email") {
    if (becamePrepared) await notifyOffice(store, result, "ready");
    else if (status === "NEEDS_REPLY" && previous !== "NEEDS_REPLY") await notifyOffice(store, result, "attention");
  }
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
