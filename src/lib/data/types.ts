/**
 * Prozessstatus eines Intake-Vorgangs:
 * NEW → QUALIFYING (KI im Gespräch) → WAITING_FOR_CUSTOMER (Kunde muss liefern)
 * → COMPLETE (Pflichtangaben da, Dokumentenlage offen) → READY_FOR_REVIEW (Angaben da, Dokumente erhalten oder angefordert)
 * → CONVERTED (vom Berater übernommen).
 */
export const CASE_STATUSES = ["NEW", "QUALIFYING", "WAITING_FOR_CUSTOMER", "COMPLETE", "READY_FOR_REVIEW", "CONVERTED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type Role = (typeof ROLES)[number];

export const QUESTION_TYPES = ["choice", "number", "text", "email", "phone", "postal"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const TONES = ["professional", "friendly", "short"] as const;
export type Tone = (typeof TONES)[number];

export const CASE_SOURCES = ["widget", "email", "whatsapp", "phone", "manual", "demo"] as const;
export type CaseSource = (typeof CASE_SOURCES)[number];

export interface Company {
  id: string;
  name: string;
  website: string;
  phone: string;
  address: string;
  services: string[];
  onboardingCompleted: boolean;
}

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
  | "prepared";

export interface CaseEvent {
  id: string;
  caseId: string;
  type: CaseEventType;
  text: string;
  createdAt: string;
}

export const MESSAGE_CHANNELS = ["website", "email", "whatsapp", "phone"] as const;
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

export interface FollowUp {
  id: string;
  caseId: string;
  companyId: string;
  kind: "document" | "info";
  message: string;
  scheduledFor: string;
  /** planned = geplant, sent = versendet, manual = fällig, aber Versand nur manuell möglich, cancelled = abgebrochen */
  status: "planned" | "sent" | "manual" | "cancelled";
  sentAt: string | null;
  note: string;
  createdAt: string;
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
}

export interface AssistantSettings {
  name: string;
  greeting: string;
  tone: Tone;
  autoReply: boolean;
  autoFollowUp: boolean;
  appointmentBooking: boolean;
  humanHandoff: boolean;
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

export type ChannelKind = "website" | "gmail" | "microsoft" | "whatsapp";
export interface Channel {
  kind: ChannelKind;
  status: "connected" | "disconnected" | "coming_soon";
  account: string;
}

export interface Subscription {
  plan: "starter" | "pro" | "business";
  status: "trialing" | "active" | "past_due" | "canceled";
  currentPeriodEnd: string | null;
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
}

export type CaseInput = Omit<CaseRecord, "id" | "createdAt" | "updatedAt" | "companyId" | "uploadToken" | "uploadTokenExpiresAt"> & {
  uploadToken?: string | null;
  uploadTokenExpiresAt?: string | null;
};
