/**
 * Prozessstatus eines Intake-Vorgangs:
 * NEW → QUALIFYING (KI im Gespräch) → WAITING_FOR_CUSTOMER (Kunde muss liefern)
 * → COMPLETE (Pflichtangaben da, Dokumentenlage offen) → READY_FOR_REVIEW (Angaben da, Dokumente erhalten oder angefordert)
 * → CONVERTED (vom Berater übernommen).
 */
export const CASE_STATUSES = ["NEW", "QUALIFYING", "WAITING_FOR_CUSTOMER", "NEEDS_REPLY", "COMPLETE", "READY_FOR_REVIEW", "CONVERTED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type Role = (typeof ROLES)[number];

export const QUESTION_TYPES = ["choice", "number", "text", "email", "phone", "postal"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const TONES = ["professional", "friendly", "short"] as const;
export type Tone = (typeof TONES)[number];

export const CASE_SOURCES = ["widget", "email", "phone", "whatsapp", "manual", "demo"] as const;
export type CaseSource = (typeof CASE_SOURCES)[number];

export interface Company {
  id: string;
  name: string;
  website: string;
  phone: string;
  address: string;
  services: string[];
  onboardingCompleted: boolean;
  /** Bei der Leistung "Fördermittelberatung": zusätzlich Energieausweis/Grundriss verlangen? Standard: nein. */
  foerderEnergyCertificate: boolean;
  foerderFloorplan: boolean;
  /** Betriebsprofil (FallFlow): Branche, Beschreibung, Unterlagen und Themen für den Menschen. Leer = noch nicht eingerichtet. */
  businessProfile: BusinessProfile;
  /** Anlagezeitpunkt (ISO). */
  createdAt: string;
}

export interface BusinessProfile {
  /** z. B. "Dachdeckerei" – leer, solange das Profil nicht eingerichtet ist */
  industry: string;
  /** Kurzbeschreibung des Betriebs in eigenen Worten (für KI-Antworten und Website-Chat) */
  description: string;
  /** Unterlagen, die Kunden typischerweise schicken sollen (z. B. "Fotos vom Schaden") */
  documents: string[];
  /** Themen, bei denen nicht die KI, sondern der Betrieb selbst antwortet (z. B. "Preise", "Notfälle") */
  humanTopics: string[];
  /** Je Leistung, welche dieser Unterlagen der Kunde schicken soll. Fehlt eine Leistung = alle Unterlagen. */
  documentsByService?: Record<string, string[]>;
  /** Braucht der Betrieb die Adresse des Kunden (Einsatz vor Ort)? Fehlt = ja. Friseur, Werkstatt o. Ä.: nein. */
  needsAddress?: boolean;
  /** Je Angabe (Schlüssel der Frage), bei welchen Leistungen sie gebraucht wird. Fehlt/leer = bei allen. */
  fieldServices?: Record<string, string[]>;
  /** Telefon-Assistent: nach Verbrauch der Inklusivminuten keine Anrufe mehr annehmen (statt Zusatzminuten). */
  phoneStopAtLimit?: boolean;
  /** Je PDF-Vorlage die darin abgefragten Angaben – im Chat (WhatsApp, Telefon) werden sie einzeln gefragt statt das PDF zu schicken. */
  templateQuestions?: Record<string, { key: string; label: string; prompt: string }[]>;
  /** Was im WhatsApp-Chat gefragt wird (eigene Seite, von der KI vorgeschlagen, vom Betrieb bearbeitet). Gesetzt = NUR diese
   * Fragen (plus die Leistung, falls noch unklar); fehlt = wie im Website-Chat. */
  whatsappQuestions?: WhatsAppQuestion[];
}

export interface WhatsAppQuestion {
  /** Schlüssel in der Fallakte – Standardangaben (postalCode, street …) und Profil-Angaben werden wiederverwendet. */
  key: string;
  label: string;
  prompt: string;
  /** Nur bei diesen Leistungen fragen; leer = immer. */
  services: string[];
}

/** Diese Standardfragen bleiben auch mit eigener WhatsApp-Liste aktiv (Name/Telefon kennt WhatsApp meist schon). */
const WHATSAPP_ALWAYS = ["service", "name", "phone"];

/** Ergänzt die Fragen um die Leistungen, für die sie laut Betriebsprofil gelten (z. B. "Heizungsart" nicht bei Badsanierung). */
export function withAppliesTo(questions: Question[], profile: Pick<BusinessProfile, "fieldServices" | "whatsappQuestions">): Question[] {
  const scope = profile.fieldServices ?? {};
  const scoped = questions.map((q) => (scope[q.key]?.length ? { ...q, appliesTo: scope[q.key] } : q));
  const wa = profile.whatsappQuestions ?? [];
  if (!wa.length) return scoped;
  // Eigene WhatsApp-Liste: übrige Fragen bei WhatsApp-Fällen ausblenden, WhatsApp-Fragen nur dort stellen.
  const waByKey = new Map(wa.map((w) => [w.key, w]));
  const base = scoped.map((q) => {
    const w = waByKey.get(q.key);
    if (w) return { ...q, label: w.label, prompt: w.prompt, appliesTo: w.services.length ? w.services : q.appliesTo };
    return WHATSAPP_ALWAYS.includes(q.key) ? q : { ...q, hiddenOnWhatsApp: true };
  });
  const extra: Question[] = wa
    .filter((w) => !scoped.some((q) => q.key === w.key))
    .map((w, i) => ({ id: `wa-${w.key}`, companyId: "", key: w.key, label: w.label, prompt: w.prompt, type: "text", options: [], required: true, active: true, position: 100 + i, appliesTo: w.services.length ? w.services : undefined, whatsappOnly: true }));
  return [...base, ...extra];
}

/** Unterlagen aus dem Betriebsprofil, die bei dieser Leistung angefragt werden. */
export function profileDocumentsFor(profile: Pick<BusinessProfile, "documents" | "documentsByService">, service: string): string[] {
  const chosen = profile.documentsByService?.[service];
  return chosen ? profile.documents.filter((d) => chosen.includes(d)) : profile.documents;
}

export const EMPTY_BUSINESS_PROFILE: BusinessProfile = { industry: "", description: "", documents: [], humanTopics: [] };

export interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface CaseRecord {
  id: string;
  companyId: string;
  status: CaseStatus;
  completeness: number;
  customerName: string;
  service: string;
  source: CaseSource;
  summary: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  /** Alle erfassten Angaben, Schlüssel = Feldschlüssel der Fragen (z. B. yearBuilt). */
  fields: Record<string, string>;
  /** Geheimer Link-Token für den Kunden-Upload (nur Dashboard-Nutzer sehen ihn, nie öffentliche Antworten). */
  uploadToken: string | null;
  uploadTokenExpiresAt: string | null;
}

export type CaseEventType =
  | "received"
  | "question"
  | "answer"
  | "complete"
  | "status"
  | "appointment"
  | "handoff"
  | "note"
  | "document"
  | "followup"
  | "prepared"
  | "assessment";

export interface CaseEvent {
  id: string;
  caseId: string;
  type: CaseEventType;
  text: string;
  createdAt: string;
}

export const MESSAGE_CHANNELS = ["website", "email", "phone", "whatsapp"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

/** delivered = beim Kunden angekommen (z. B. Website-Chat), not_sent = Kanal nicht verbunden, internal = interne Notiz. */
export type MessageDelivery = "delivered" | "not_sent" | "internal";

export interface CaseMessage {
  id: string;
  caseId: string;
  /** user = Kunde, assistant = KI, staff = Mitarbeiter/Telefonnotiz */
  role: "user" | "assistant" | "staff";
  content: string;
  createdAt: string;
  channel: MessageChannel;
  delivery: MessageDelivery;
  /** true = im Simulator erzeugt, keine echte Nachricht des Kanals */
  simulated: boolean;
}

export interface MessageMeta {
  channel?: MessageChannel;
  delivery?: MessageDelivery;
  simulated?: boolean;
}

export const DOCUMENT_KINDS = ["floorplan", "energy_certificate", "photos", "other"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Ein angefordertes (requested) oder hochgeladenes (received) Dokument eines Falls. */
export interface CaseDocument {
  id: string;
  caseId: string;
  companyId: string;
  kind: DocumentKind;
  status: "requested" | "received";
  fileName: string;
  mimeType: string;
  size: number;
  /** Pfad im privaten Speicher, nie an Clients ausliefern */
  storagePath: string;
  requestedAt: string;
  receivedAt: string | null;
}

export interface Question {
  id: string;
  companyId: string;
  key: string;
  label: string;
  prompt: string;
  type: QuestionType;
  options: string[];
  required: boolean;
  active: boolean;
  position: number;
  /** Nur bei diesen Leistungen fragen (aus dem Betriebsprofil, nicht in der Fragen-Tabelle gespeichert). Fehlt = immer. */
  appliesTo?: string[];
  /** Nur im WhatsApp-Chat fragen (aus der WhatsApp-Liste, nicht in der Fragen-Tabelle gespeichert). */
  whatsappOnly?: boolean;
  /** Bei WhatsApp-Fällen nicht fragen (es gibt eine eigene WhatsApp-Liste). */
  hiddenOnWhatsApp?: boolean;
}

export interface AssistantSettings {
  name: string;
  greeting: string;
  tone: Tone;
  autoReply: boolean;
  autoFollowUp: boolean;
  appointmentBooking: boolean;
  humanHandoff: boolean;
  /** Wochentage, an denen Termine angeboten werden: 0 = Sonntag … 6 = Samstag (JS-Konvention). */
  workingDays: number[];
  /** Uhrzeit „HH:MM“, ab der Termine angeboten werden. */
  slotStart: string;
  /** Uhrzeit „HH:MM“, bis zu der Termine angeboten werden. */
  slotEnd: string;
  /** Dauer eines vorgeschlagenen Termins in Minuten. */
  slotMinutes: number;
  /** Höchstzahl an Terminen, die die KI pro Kalendertag vergibt. null = unbegrenzt (nur durch Bürozeiten begrenzt). */
  maxAppointmentsPerDay: number | null;
  /** Urlaubs-/Pausenzeitraum (inklusive, "YYYY-MM-DD"). Während dieser Zeit schlägt die KI keine Termine vor. null = kein Urlaub eingetragen. */
  vacationFrom: string | null;
  vacationUntil: string | null;
  /** Nachricht an den Kunden, sobald ein Mitarbeiter den Termin bestätigt. "(Termin)" wird durch Datum/Uhrzeit ersetzt (Platzhalter weglassen = kein Datum per Mail nennen, z. B. bei telefonischer Terminabstimmung). Leer = Standardtext. */
  appointmentConfirmedTemplate: string;
  /** E-Mail an das Büro, wenn ein Kunde eine Frage stellt / die Leistung unklar ist ("Aufmerksamkeit benötigt"). */
  notifyAttention: boolean;
  /** E-Mail an das Büro, wenn ein Fall fertig vorbereitet ist ("Bereit zur Prüfung"). */
  notifyReady: boolean;
  /** Empfänger der Benachrichtigungen. Leer = alle Inhaber und Admins des Büros. */
  notifyEmail: string;
}

export interface Appointment {
  id: string;
  companyId: string;
  caseId: string | null;
  title: string;
  startsAt: string;
  durationMin: number;
  notes: string;
  /** proposed = dem Kunden vorgeschlagen, confirmed = bestätigt */
  status: "proposed" | "confirmed";
}

export interface Member {
  id: string;
  companyId: string;
  userId: string | null;
  email: string;
  name: string;
  role: Role;
  status: "active" | "invited";
}

/** Büro-eigene PDF-Vorlage (z. B. eine Vollmacht), einer Leistung zugeordnet – wird Kunden automatisch als Download-Link geschickt. */
export interface DocumentTemplate {
  id: string;
  companyId: string;
  service: string;
  title: string;
  fileName: string;
  storagePath: string;
  createdAt: string;
  /** true = wird bei jeder neuen Anfrage mitgeschickt, unabhängig von der erkannten Leistung (z. B. eine
   * Datenschutz-Einwilligung, die jeder Kunde ausfüllen muss). */
  alwaysInclude: boolean;
  /** true = der Kunde soll die Vorlage ausgefüllt zurückschicken (zählt zur Vollständigkeit); false = wird nur zur
   * Information mitgeschickt (z. B. Preisliste, Datenschutzhinweis). */
  requiresReturn: boolean;
}

/** Individuell editierbarer Nachrichtentext pro Leistung – wird zusätzlich zu den Vorlagen-Links verschickt,
 * sobald die KI bei einer Kundenanfrage die passende Leistung erkennt (siehe engine.ts). */
export interface ServiceMessage {
  id: string;
  companyId: string;
  service: string;
  body: string;
  /** Ersetzt die sonst feste, tonabhängige Standardformulierung ("Ein Mitarbeiter meldet sich ..."),
   * sobald der Fall für diese Leistung vollständig ist. Leer = Standardtext verwenden. */
  appointmentNote: string;
  /** Welche Dokumente braucht das Büro für diese Leistung wirklich? null = Standardverhalten je Leistung
   * (siehe checklist.ts documentRequirements), sonst vom Büro ausdrücklich festgelegt. */
  requiresFloorplan: boolean | null;
  requiresEnergyCertificate: boolean | null;
  /** Betreff der automatischen E-Mails zu dieser Leistung. Leer = Standardbetreff. */
  subject: string;
}

/** Rückweg einer Büro-PDF-Vorlage: 'sent' = an den Kunden geschickt, 'received' = ausgefüllt zurück,
 * 'info' = nur zur Information mitgeschickt (kommt nicht zurück). */
export interface TemplateDocument {
  id: string;
  companyId: string;
  caseId: string;
  templateId: string;
  status: "sent" | "received" | "info";
  storagePath: string;
  /** Kurzer KI-Hinweis, ob das zurückgeschickte Dokument ausgefüllt wirkt. */
  aiNote: string;
  /** KI-Einschätzung, ob das Dokument tatsächlich ausgefüllt ist: true = ja, false = wirkt leer/unvollständig
   * (zählt dann nicht als vollständig, siehe checklist.ts), null = keine KI-Einschätzung möglich (kein Key o. Ä.). */
  filled: boolean | null;
  createdAt: string;
  receivedAt: string | null;
}

export type ChannelKind = "website" | "gmail";
export interface Channel {
  kind: ChannelKind;
  status: "connected" | "disconnected" | "coming_soon";
  account: string;
}

export interface Subscription {
  plan: "starter" | "pro" | "business";
  status: "trialing" | "active" | "past_due" | "canceled";
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  /** true = Abo laeuft bis currentPeriodEnd weiter, verlaengert sich danach aber nicht automatisch. */
  cancelAtPeriodEnd: boolean;
  /** Wann das Abo endgültig beendet wurde (status "canceled"); 30 Tage danach werden alle Daten gelöscht. */
  canceledAt: string | null;
}

export interface CaseFilters {
  q?: string;
  status?: CaseStatus | "";
  service?: string;
  minCompleteness?: number;
  from?: string;
  sort?: "newest" | "oldest" | "completeness" | "name";
}

export interface DashboardStats {
  /** Neue Anfragen (Status NEW) */
  newRequests: number;
  /** Fälle mit Status READY_FOR_REVIEW oder COMPLETE */
  completeCases: number;
  /** Fälle, die auf Kundendaten warten (WAITING_FOR_CUSTOMER) */
  waitingForCustomer: number;
  /** Heute anstehende Termine */
  appointmentsToday: number;
  /** Ohne Zutun des Büros durch KI-Intake bis zur Bearbeitungsreife qualifiziert */
  autoQualified: number;
  /** E-Mails, auf die der Energieberater selbst antworten soll ("Aufmerksamkeit benötigt") */
  needsAttention: number;
}

export type CaseInput = Omit<CaseRecord, "id" | "createdAt" | "updatedAt" | "companyId" | "uploadToken" | "uploadTokenExpiresAt"> & {
  uploadToken?: string | null;
  uploadTokenExpiresAt?: string | null;
};
