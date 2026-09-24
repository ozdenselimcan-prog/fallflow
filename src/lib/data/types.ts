export const CASE_STATUSES = ["NEW", "NEEDS_INFO", "COMPLETE", "CONTACTED", "APPOINTMENT", "CLOSED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type Role = (typeof ROLES)[number];

export const QUESTION_TYPES = ["choice", "number", "text", "email", "phone", "postal"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const TONES = ["professional", "friendly", "short"] as const;
export type Tone = (typeof TONES)[number];

export const CASE_SOURCES = ["widget", "email", "whatsapp", "manual", "demo"] as const;
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
}

export type CaseEventType = "received" | "question" | "answer" | "complete" | "status" | "appointment" | "handoff" | "note";

export interface CaseEvent {
  id: string;
  caseId: string;
  type: CaseEventType;
  text: string;
  createdAt: string;
}

export interface CaseMessage {
  id: string;
  caseId: string;
  role: "user" | "assistant";
  content: string;
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
  newRequests: number;
  completeCases: number;
  openQuestions: number;
  appointments: number;
}

export type CaseInput = Omit<CaseRecord, "id" | "createdAt" | "updatedAt" | "companyId">;
