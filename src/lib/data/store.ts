import type {
  Appointment,
  AssistantSettings,
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
  Member,
  Profile,
  Question,
  Role,
  Subscription,
} from "./types";

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
  updateCase(id: string, patch: { status?: CaseStatus; fields?: Record<string, string>; assignedTo?: string | null; summary?: string; completeness?: number; customerName?: string; service?: string }): Promise<CaseRecord | null>;
  deleteCase(id: string): Promise<void>;

  listEvents(caseId: string): Promise<CaseEvent[]>;
  addEvent(caseId: string, type: CaseEventType, text: string): Promise<void>;
  listMessages(caseId: string): Promise<CaseMessage[]>;
  addMessage(caseId: string, role: "user" | "assistant", content: string): Promise<CaseMessage>;

  listQuestions(): Promise<Question[]>;
  saveQuestion(q: Omit<Question, "companyId" | "id" | "position"> & { id?: string; position?: number }): Promise<Question>;
  deleteQuestion(id: string): Promise<void>;
  reorderQuestions(orderedIds: string[]): Promise<void>;
  setActiveQuestionKeys(activeKeys: string[]): Promise<void>;

  getAssistant(): Promise<AssistantSettings>;
  saveAssistant(s: AssistantSettings): Promise<AssistantSettings>;

  listAppointments(): Promise<Appointment[]>;
  saveAppointment(a: Omit<Appointment, "companyId" | "id"> & { id?: string }): Promise<Appointment>;
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

/** Filter/Sortierung, die beide Store-Implementierungen teilen. */
export function applyCaseFilters(list: CaseRecord[], f: CaseFilters = {}): CaseRecord[] {
  const q = f.q?.trim().toLowerCase();
  let out = list.filter((c) => {
    if (f.status && c.status !== f.status) return false;
    if (f.service && c.service !== f.service) return false;
    if (f.minCompleteness != null && c.completeness < f.minCompleteness) return false;
    if (f.from && c.createdAt < f.from) return false;
    if (q) {
      const hay = [c.customerName, c.service, c.fields.email, c.fields.postalCode, c.fields.description].join(" ").toLowerCase();
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

export function computeStats(cases: CaseRecord[], appointments: Appointment[]): DashboardStats {
  const now = new Date().toISOString();
  return {
    newRequests: cases.filter((c) => c.status === "NEW" || c.status === "NEEDS_INFO").length,
    completeCases: cases.filter((c) => c.status === "COMPLETE").length,
    openQuestions: cases.filter((c) => c.status === "NEEDS_INFO").length,
    appointments: appointments.filter((a) => a.startsAt >= now).length,
  };
}
