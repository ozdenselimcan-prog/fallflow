import { buildSummary, computeCompleteness } from "@/lib/cases/completeness";
import { DEFAULT_ASSISTANT } from "@/lib/cases/fields";
import {
  DEMO_COMPANY_ID,
  seedAppointments,
  seedAssistant,
  seedCaseRecords,
  seedCompany,
  seedEvents,
  seedMembers,
  seedMessages,
  seedQuestions,
} from "./seed";
import { applyCaseFilters, computeStats, CHANNEL_ORDER, type Store } from "./store";
import type { Appointment, AssistantSettings, CaseEvent, CaseMessage, CaseRecord, Company, Member, Question } from "./types";

interface MemoryDb {
  company: Company;
  cases: CaseRecord[];
  events: CaseEvent[];
  messages: CaseMessage[];
  questions: Question[];
  assistant: AssistantSettings;
  appointments: Appointment[];
  members: Member[];
}

const g = globalThis as unknown as { __fallflowDb?: MemoryDb };

function db(): MemoryDb {
  g.__fallflowDb ??= {
    company: seedCompany(),
    cases: seedCaseRecords(),
    events: seedEvents(),
    messages: seedMessages(),
    questions: seedQuestions(),
    assistant: seedAssistant(),
    appointments: seedAppointments(),
    members: seedMembers(),
  };
  return g.__fallflowDb;
}

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

/** Demo-Store: In-Memory, wird beim Neustart des Servers zurückgesetzt. */
export function createMemoryStore(): Store {
  return {
    async getCompany() {
      return db().company;
    },
    async updateCompany(patch) {
      db().company = { ...db().company, ...patch };
      return db().company;
    },

    async listCases(filters) {
      return applyCaseFilters(db().cases, filters);
    },
    async getCase(id) {
      return db().cases.find((c) => c.id === id) ?? null;
    },
    async createCase(input) {
      const fields = input.fields ?? {};
      const c: CaseRecord = {
        id: uid(),
        companyId: DEMO_COMPANY_ID,
        status: input.status ?? "NEW",
        completeness: input.completeness ?? computeCompleteness(db().questions, fields),
        customerName: input.customerName ?? fields.name ?? "Unbekannt",
        service: input.service ?? fields.service ?? "",
        source: input.source ?? "manual",
        summary: input.summary ?? buildSummary(fields),
        assignedTo: input.assignedTo ?? null,
        createdAt: now(),
        updatedAt: now(),
        fields,
      };
      db().cases.unshift(c);
      return c;
    },
    async updateCase(id, patch) {
      const c = db().cases.find((x) => x.id === id);
      if (!c) return null;
      if (patch.status) c.status = patch.status;
      if (patch.fields) c.fields = { ...c.fields, ...patch.fields };
      if (patch.assignedTo !== undefined) c.assignedTo = patch.assignedTo;
      if (patch.summary !== undefined) c.summary = patch.summary;
      if (patch.completeness !== undefined) c.completeness = patch.completeness;
      if (patch.customerName !== undefined) c.customerName = patch.customerName;
      if (patch.service !== undefined) c.service = patch.service;
      c.updatedAt = now();
      return c;
    },
    async deleteCase(id) {
      const d = db();
      d.cases = d.cases.filter((c) => c.id !== id);
      d.events = d.events.filter((e) => e.caseId !== id);
      d.messages = d.messages.filter((m) => m.caseId !== id);
    },

    async listEvents(caseId) {
      return db().events.filter((e) => e.caseId === caseId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async addEvent(caseId, type, text) {
      db().events.push({ id: uid(), caseId, type, text, createdAt: now() });
    },
    async listMessages(caseId) {
      return db().messages.filter((m) => m.caseId === caseId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async addMessage(caseId, role, content) {
      const m: CaseMessage = { id: uid(), caseId, role, content, createdAt: now() };
      db().messages.push(m);
      return m;
    },

    async listQuestions() {
      return [...db().questions].sort((a, b) => a.position - b.position);
    },
    async saveQuestion(q) {
      const d = db();
      const existing = q.id ? d.questions.find((x) => x.id === q.id) : undefined;
      if (existing) {
        Object.assign(existing, q, { position: q.position ?? existing.position });
        return existing;
      }
      const created: Question = { ...q, id: uid(), companyId: DEMO_COMPANY_ID, position: q.position ?? d.questions.length };
      d.questions.push(created);
      return created;
    },
    async deleteQuestion(id) {
      db().questions = db().questions.filter((q) => q.id !== id);
    },
    async reorderQuestions(orderedIds) {
      orderedIds.forEach((id, i) => {
        const q = db().questions.find((x) => x.id === id);
        if (q) q.position = i;
      });
    },
    async setActiveQuestionKeys(activeKeys) {
      db().questions.forEach((q) => {
        q.active = activeKeys.includes(q.key);
      });
    },

    async getAssistant() {
      return db().assistant ?? DEFAULT_ASSISTANT;
    },
    async saveAssistant(s) {
      db().assistant = s;
      return s;
    },

    async listAppointments() {
      return [...db().appointments].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    },
    async saveAppointment(a) {
      const d = db();
      const existing = a.id ? d.appointments.find((x) => x.id === a.id) : undefined;
      if (existing) {
        Object.assign(existing, a);
        return existing;
      }
      const created: Appointment = { ...a, id: uid(), companyId: DEMO_COMPANY_ID };
      d.appointments.push(created);
      return created;
    },
    async deleteAppointment(id) {
      db().appointments = db().appointments.filter((a) => a.id !== id);
    },

    async listMembers() {
      return db().members;
    },
    async inviteMember(email, role) {
      const m: Member = { id: uid(), companyId: DEMO_COMPANY_ID, userId: null, email, name: "", role, status: "invited" };
      db().members.push(m);
      return m;
    },
    async updateMemberRole(id, role) {
      const m = db().members.find((x) => x.id === id);
      if (m) m.role = role;
    },
    async removeMember(id) {
      db().members = db().members.filter((m) => m.id !== id);
    },

    async listChannels() {
      return CHANNEL_ORDER.map((kind) => ({
        kind,
        status: kind === "website" ? ("connected" as const) : kind === "whatsapp" ? ("coming_soon" as const) : ("disconnected" as const),
        account: "",
      }));
    },
    async getSubscription() {
      return { plan: "pro", status: "trialing", currentPeriodEnd: null };
    },
    async getStats() {
      return computeStats(db().cases, db().appointments);
    },
  };
}
