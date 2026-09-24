import { effectiveStatus } from "@/lib/intake/checklist";
import type {
  Appointment,
  AssistantSettings,
  CaseDocument,
  CaseEvent,
  CaseEventType,
  CaseFilters,
  CaseInput,
  CaseMessage,
  CaseRecord,
  CaseStatus,
  Channel,
  ChannelKind,
  Company,
  DashboardStats,
  FollowUp,
  Member,
  MessageMeta,
  Profile,
  Question,
  Role,
  Subscription,
} from "./types";

export interface CasePatch {
  status?: CaseStatus;
  fields?: Record<string, string>;
  assignedTo?: string | null;
  summary?: string;
  completeness?: number;
  customerName?: string;
  service?: string;
  uploadToken?: string | null;
  uploadTokenExpiresAt?: string | null;
  /** true = updatedAt nicht anfassen (z. B. Hintergrund-Aktualisierungen ohne Kundenaktivität) */
  keepTimestamp?: boolean;
}

export type DocumentInput = Omit<CaseDocument, "id" | "companyId"> & { id?: string };
export type FollowUpInput = Omit<FollowUp, "id" | "companyId" | "createdAt"> & { id?: string };

/**
 * Datenzugriff pro Mandant (Company). Es gibt zwei Implementierungen:
 * - memory.ts   (Demo-Modus ohne Supabase)
 * - supabase.ts (RLS-geschützte Postgres-Daten)
 */
export interface Store {
  getCompany(): Promise<Company>;
  updateCompany(patch: Partial<Omit<Company, "id">>): Promise<Company>;

  listCases(filters?: CaseFilters): Promise<CaseRecord[]>;
  getCase(id: string): Promise<CaseRecord | null>;
  createCase(input: Partial<CaseInput> & { fields?: Record<string, string> }): Promise<CaseRecord>;
  updateCase(id: string, patch: CasePatch): Promise<CaseRecord | null>;
  deleteCase(id: string): Promise<void>;

  listEvents(caseId: string): Promise<CaseEvent[]>;
  listRecentEvents(limit?: number): Promise<CaseEvent[]>;
  addEvent(caseId: string, type: CaseEventType, text: string): Promise<void>;
  listMessages(caseId: string): Promise<CaseMessage[]>;
  listRecentMessages(limit?: number): Promise<CaseMessage[]>;
  addMessage(caseId: string, role: CaseMessage["role"], content: string, meta?: MessageMeta): Promise<CaseMessage>;

  /** Ohne caseId: alle Dokumente des Büros. */
  listDocuments(caseId?: string): Promise<CaseDocument[]>;
  getDocument(id: string): Promise<CaseDocument | null>;
  saveDocument(doc: DocumentInput): Promise<CaseDocument>;

  /** Ohne caseId: alle Follow-ups des Büros. */
  listFollowUps(caseId?: string): Promise<FollowUp[]>;
  saveFollowUp(f: FollowUpInput): Promise<FollowUp>;

  listQuestions(): Promise<Question[]>;
  saveQuestion(q: Omit<Question, "companyId" | "id" | "position"> & { id?: string; position?: number }): Promise<Question>;
  deleteQuestion(id: string): Promise<void>;
  reorderQuestions(orderedIds: string[]): Promise<void>;
  setActiveQuestionKeys(activeKeys: string[]): Promise<void>;

  getAssistant(): Promise<AssistantSettings>;
  saveAssistant(s: AssistantSettings): Promise<AssistantSettings>;

  listAppointments(): Promise<Appointment[]>;
  saveAppointment(a: Omit<Appointment, "companyId" | "id" | "status"> & { id?: string; status?: Appointment["status"] }): Promise<Appointment>;
  deleteAppointment(id: string): Promise<void>;

  listMembers(): Promise<Member[]>;
  inviteMember(email: string, role: Role): Promise<Member>;
  updateMemberRole(id: string, role: Role): Promise<void>;
  removeMember(id: string): Promise<void>;

  listChannels(): Promise<Channel[]>;
  getSubscription(): Promise<Subscription>;
  getStats(): Promise<DashboardStats>;
}

export interface ProfileStore {
  getProfile(userId: string): Promise<Profile | null>;
  updateProfile(userId: string, patch: { firstName: string; lastName: string }): Promise<void>;
}

export const CHANNEL_ORDER: ChannelKind[] = ["website", "gmail", "microsoft", "whatsapp"];

/** Ein laufendes Gespräch ohne Aktivität gilt als „wartet auf Kunde“ – wird beim Lesen abgeleitet, nicht gespeichert. */
export const withEffectiveStatus = (c: CaseRecord): CaseRecord => {
  const status = effectiveStatus(c);
  return status === c.status ? c : { ...c, status };
};

/** Filter/Sortierung, die beide Store-Implementierungen teilen. */
export function applyCaseFilters(list: CaseRecord[], f: CaseFilters = {}): CaseRecord[] {
  const q = f.q?.trim().toLowerCase();
  let out = list.filter((c) => {
    if (f.status && c.status !== f.status) return false;
    if (f.service && c.service !== f.service) return false;
    if (f.minCompleteness != null && c.completeness < f.minCompleteness) return false;
    if (f.from && c.createdAt < f.from) return false;
    if (q) {
      const hay = [c.customerName, c.service, c.fields.email, c.fields.postalCode, c.fields.phone, c.fields.description].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const sort = f.sort ?? "newest";
  out = [...out].sort((a, b) => {
    if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
    if (sort === "completeness") return b.completeness - a.completeness;
    if (sort === "name") return a.customerName.localeCompare(b.customerName, "de");
    return b.createdAt.localeCompare(a.createdAt);
  });
  return out;
}

const berlinDay = (d: Date | string) => new Date(d).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
const AUTO_SOURCES: CaseRecord["source"][] = ["widget", "email", "whatsapp"];

export function computeStats(cases: CaseRecord[], appointments: Appointment[]): DashboardStats {
  const today = berlinDay(new Date());
  return {
    newRequests: cases.filter((c) => c.status === "NEW").length,
    completeCases: cases.filter((c) => c.status === "READY_FOR_REVIEW" || c.status === "COMPLETE").length,
    waitingForCustomer: cases.filter((c) => c.status === "WAITING_FOR_CUSTOMER").length,
    appointmentsToday: appointments.filter((a) => berlinDay(a.startsAt) === today).length,
    autoQualified: cases.filter((c) => AUTO_SOURCES.includes(c.source) && ["COMPLETE", "READY_FOR_REVIEW", "CONVERTED"].includes(c.status)).length,
  };
}
