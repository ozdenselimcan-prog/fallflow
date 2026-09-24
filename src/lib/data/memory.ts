import { buildSummary, computeCompleteness } from "@/lib/cases/completeness";
import { DEFAULT_ASSISTANT } from "@/lib/cases/fields";
import {
  DEMO_COMPANY_ID,
  seedAppointments,
  seedAssistant,
  seedCaseRecords,
  seedCompany,
  seedDocuments,
  seedEvents,
  seedFollowUps,
  seedMembers,
  seedMessages,
  seedQuestions,
} from "./seed";
import { applyCaseFilters, CHANNEL_ORDER, computeStats, withEffectiveStatus, type Store } from "./store";
import type { Appointment, AssistantSettings, CaseDocument, CaseEvent, CaseMessage, CaseRecord, Company, FollowUp, Member, Question } from "./types";

interface MemoryDb {
  company: Company;
  cases: CaseRecord[];
  events: CaseEvent[];
  messages: CaseMessage[];
  documents: CaseDocument[];
  followUps: FollowUp[];
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
    documents: seedDocuments(),
    followUps: seedFollowUps(),
    questions: seedQuestions(),
    assistant: seedAssistant(),
    appointments: seedAppointments(),
    members: seedMembers(),
  };
  return g.__fallflowDb;
}

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

/** Fall zu einem Upload-Token finden (öffentlicher Upload-Link im Demo-Modus). */
export function findMemoryCaseByToken(token: string): CaseRecord | null {
  return db().cases.find((c) => c.uploadToken === token) ?? null;
}

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
      return applyCaseFilters(db().cases.map(withEffectiveStatus), filters);
    },
    async getCase(id) {
      const c = db().cases.find((x) => x.id === id);
      return c ? withEffectiveStatus(c) : null;
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
        uploadToken: input.uploadToken ?? null,
        uploadTokenExpiresAt: input.uploadTokenExpiresAt ?? null,
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
      if (patch.uploadToken !== undefined) c.uploadToken = patch.uploadToken;
      if (patch.uploadTokenExpiresAt !== undefined) c.uploadTokenExpiresAt = patch.uploadTokenExpiresAt;
      if (!patch.keepTimestamp) c.updatedAt = now();
      return withEffectiveStatus(c);
    },
    async deleteCase(id) {
      const d = db();
      d.cases = d.cases.filter((c) => c.id !== id);
      d.events = d.events.filter((e) => e.caseId !== id);
      d.messages = d.messages.filter((m) => m.caseId !== id);
      d.documents = d.documents.filter((x) => x.caseId !== id);
      d.followUps = d.followUps.filter((x) => x.caseId !== id);
    },

    async listEvents(caseId) {
      return db().events.filter((e) => e.caseId === caseId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async listRecentEvents(limit = 20) {
      return [...db().events].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    },
    async addEvent(caseId, type, text) {
      db().events.push({ id: uid(), caseId, type, text, createdAt: now() });
    },
    async listMessages(caseId) {
      return db().messages.filter((m) => m.caseId === caseId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async listRecentMessages(limit = 300) {
      return [...db().messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    },
    async addMessage(caseId, role, content, meta) {
      const m: CaseMessage = {
        id: uid(),
        caseId,
        role,
        content,
        createdAt: now(),
        channel: meta?.channel ?? "website",
        delivery: meta?.delivery ?? (role === "staff" ? "internal" : "delivered"),
        simulated: meta?.simulated ?? false,
      };
      db().messages.push(m);
      return m;
    },

    async listDocuments(caseId) {
      return db().documents.filter((d) => !caseId || d.caseId === caseId);
    },
    async getDocument(id) {
      return db().documents.find((d) => d.id === id) ?? null;
    },
    async saveDocument(doc) {
      const d = db();
      const existing = doc.id ? d.documents.find((x) => x.id === doc.id) : undefined;
      if (existing) {
        Object.assign(existing, doc);
        return existing;
      }
      const created: CaseDocument = { ...doc, id: uid(), companyId: DEMO_COMPANY_ID };
      d.documents.push(created);
      return created;
    },

    async listFollowUps(caseId) {
      return db()
        .followUps.filter((f) => !caseId || f.caseId === caseId)
        .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
    },
    async saveFollowUp(f) {
      const d = db();
      const existing = f.id ? d.followUps.find((x) => x.id === f.id) : undefined;
      if (existing) {
        Object.assign(existing, f);
        return existing;
      }
      const created: FollowUp = { ...f, id: uid(), companyId: DEMO_COMPANY_ID, createdAt: now() };
      d.followUps.push(created);
      return created;
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
      const created: Appointment = { ...a, id: uid(), companyId: DEMO_COMPANY_ID, status: a.status ?? "confirmed" };
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
      return computeStats(db().cases.map(withEffectiveStatus), db().appointments);
    },
  };
}
