import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSummary, computeCompleteness } from "@/lib/cases/completeness";
import { applyCaseFilters, CHANNEL_ORDER, computeStats, withEffectiveStatus, type Store } from "./store";
import type {
  Appointment,
  AssistantSettings,
  CaseDocument,
  CaseEvent,
  CaseMessage,
  CaseRecord,
  Channel,
  Company,
  FollowUp,
  Member,
  Question,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function fail(error: { message: string } | null, what: string): asserts error is null {
  if (error) {
    // Bewusst nur die Fehlermeldung, keine Nutzdaten loggen.
    console.error(`[store] ${what}: ${error.message}`);
    throw new Error(`Datenbankfehler (${what})`);
  }
}

const mapCompany = (r: Row): Company => ({
  id: r.id,
  name: r.name,
  website: r.website,
  phone: r.phone,
  address: r.address,
  services: r.services ?? [],
  onboardingCompleted: r.onboarding_completed,
});

const mapCase = (r: Row): CaseRecord => ({
  id: r.id,
  companyId: r.company_id,
  status: r.status,
  completeness: r.completeness,
  customerName: r.customer_name,
  service: r.service,
  source: r.source,
  summary: r.summary,
  assignedTo: r.assigned_to,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  fields: Object.fromEntries((r.case_fields ?? []).map((f: Row) => [f.key, f.value])),
  uploadToken: r.upload_token ?? null,
  uploadTokenExpiresAt: r.upload_token_expires_at ?? null,
});

const mapMessage = (r: Row): CaseMessage => ({
  id: r.id,
  caseId: r.case_id,
  role: r.role,
  content: r.content,
  createdAt: r.created_at,
  channel: r.channel ?? "website",
  delivery: r.delivery ?? "delivered",
  simulated: r.simulated ?? false,
});

const mapDocument = (r: Row): CaseDocument => ({
  id: r.id,
  caseId: r.case_id,
  companyId: r.company_id,
  kind: r.kind,
  status: r.status,
  fileName: r.file_name,
  mimeType: r.mime_type,
  size: r.size,
  storagePath: r.storage_path,
  requestedAt: r.requested_at,
  receivedAt: r.received_at,
});

const mapFollowUp = (r: Row): FollowUp => ({
  id: r.id,
  caseId: r.case_id,
  companyId: r.company_id,
  kind: r.kind,
  message: r.message,
  scheduledFor: r.scheduled_for,
  status: r.status,
  sentAt: r.sent_at,
  note: r.note,
  createdAt: r.created_at,
});

const mapQuestion = (r: Row): Question => ({
  id: r.id,
  companyId: r.company_id,
  key: r.key,
  label: r.label,
  prompt: r.prompt,
  type: r.type,
  options: r.options ?? [],
  required: r.required,
  active: r.active,
  position: r.position,
});

const mapAppointment = (r: Row): Appointment => ({
  id: r.id,
  companyId: r.company_id,
  caseId: r.case_id,
  title: r.title,
  startsAt: r.starts_at,
  durationMin: r.duration_min,
  notes: r.notes,
  status: r.status ?? "confirmed",
});

const mapMember = (r: Row): Member => ({
  id: r.id,
  companyId: r.company_id,
  userId: r.user_id,
  email: r.email,
  name: r.name,
  role: r.role,
  status: r.status,
});

const CASE_SELECT = "*, case_fields(key, value)";

/**
 * Supabase-Implementierung. Mit dem User-Client greift RLS; mit dem Admin-Client (Widget)
 * ist jede Abfrage zusätzlich explizit auf companyId gefiltert.
 */
export function createSupabaseStore(db: SupabaseClient, companyId: string): Store {
  const store: Store = {
    async getCompany() {
      const { data, error } = await db.from("companies").select("*").eq("id", companyId).single();
      fail(error, "company");
      return mapCompany(data!);
    },
    async updateCompany(patch) {
      const row: Row = {};
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.website !== undefined) row.website = patch.website;
      if (patch.phone !== undefined) row.phone = patch.phone;
      if (patch.address !== undefined) row.address = patch.address;
      if (patch.services !== undefined) row.services = patch.services;
      if (patch.onboardingCompleted !== undefined) row.onboarding_completed = patch.onboardingCompleted;
      const { data, error } = await db.from("companies").update(row).eq("id", companyId).select("*").single();
      fail(error, "company update");
      return mapCompany(data!);
    },

    async listCases(filters) {
      const { data, error } = await db.from("cases").select(CASE_SELECT).eq("company_id", companyId).order("created_at", { ascending: false }).limit(1000);
      fail(error, "cases");
      return applyCaseFilters((data ?? []).map(mapCase).map(withEffectiveStatus), filters);
    },
    async getCase(id) {
      const { data, error } = await db.from("cases").select(CASE_SELECT).eq("company_id", companyId).eq("id", id).maybeSingle();
      fail(error, "case");
      return data ? withEffectiveStatus(mapCase(data)) : null;
    },
    async createCase(input) {
      const fields = input.fields ?? {};
      const questions = await store.listQuestions();
      const { data, error } = await db
        .from("cases")
        .insert({
          company_id: companyId,
          status: input.status ?? "NEW",
          completeness: input.completeness ?? computeCompleteness(questions, fields),
          customer_name: input.customerName ?? fields.name ?? "",
          service: input.service ?? fields.service ?? "",
          source: input.source ?? "manual",
          summary: input.summary ?? buildSummary(fields),
          assigned_to: input.assignedTo ?? null,
          upload_token: input.uploadToken ?? null,
          upload_token_expires_at: input.uploadTokenExpiresAt ?? null,
        })
        .select("*")
        .single();
      fail(error, "case insert");
      const created = data!;
      const rows = Object.entries(fields).map(([key, value]) => ({ case_id: created.id, company_id: companyId, key, value }));
      if (rows.length) {
        const res = await db.from("case_fields").insert(rows);
        fail(res.error, "case fields");
      }
      return mapCase({ ...created, case_fields: Object.entries(fields).map(([key, value]) => ({ key, value })) });
    },
    async updateCase(id, patch) {
      const row: Row = {};
      if (!patch.keepTimestamp) row.updated_at = new Date().toISOString();
      if (patch.status) row.status = patch.status;
      if (patch.uploadToken !== undefined) row.upload_token = patch.uploadToken;
      if (patch.uploadTokenExpiresAt !== undefined) row.upload_token_expires_at = patch.uploadTokenExpiresAt;
      if (patch.assignedTo !== undefined) row.assigned_to = patch.assignedTo;
      if (patch.summary !== undefined) row.summary = patch.summary;
      if (patch.completeness !== undefined) row.completeness = patch.completeness;
      if (patch.customerName !== undefined) row.customer_name = patch.customerName;
      if (patch.service !== undefined) row.service = patch.service;
      // Ohne Änderung an der Fallzeile (nur Felder) wird nur geprüft, ob der Fall existiert.
      const { data, error } = Object.keys(row).length
        ? await db.from("cases").update(row).eq("company_id", companyId).eq("id", id).select("id").maybeSingle()
        : await db.from("cases").select("id").eq("company_id", companyId).eq("id", id).maybeSingle();
      fail(error, "case update");
      if (!data) return null;
      if (patch.fields && Object.keys(patch.fields).length) {
        const rows = Object.entries(patch.fields).map(([key, value]) => ({ case_id: id, company_id: companyId, key, value }));
        const res = await db.from("case_fields").upsert(rows, { onConflict: "case_id,key" });
        fail(res.error, "case fields upsert");
      }
      return store.getCase(id);
    },
    async deleteCase(id) {
      const { error } = await db.from("cases").delete().eq("company_id", companyId).eq("id", id);
      fail(error, "case delete");
    },

    async listEvents(caseId): Promise<CaseEvent[]> {
      const { data, error } = await db.from("case_events").select("*").eq("company_id", companyId).eq("case_id", caseId).order("created_at");
      fail(error, "events");
      return (data ?? []).map((r) => ({ id: r.id, caseId: r.case_id, type: r.type, text: r.text, createdAt: r.created_at }));
    },
    async listRecentEvents(limit = 20): Promise<CaseEvent[]> {
      const { data, error } = await db.from("case_events").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(limit);
      fail(error, "recent events");
      return (data ?? []).map((r) => ({ id: r.id, caseId: r.case_id, type: r.type, text: r.text, createdAt: r.created_at }));
    },
    async addEvent(caseId, type, text) {
      const { error } = await db.from("case_events").insert({ case_id: caseId, company_id: companyId, type, text });
      fail(error, "event insert");
    },
    async listMessages(caseId): Promise<CaseMessage[]> {
      const { data, error } = await db.from("case_messages").select("*").eq("company_id", companyId).eq("case_id", caseId).order("created_at");
      fail(error, "messages");
      return (data ?? []).map(mapMessage);
    },
    async listRecentMessages(limit = 300): Promise<CaseMessage[]> {
      const { data, error } = await db.from("case_messages").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(limit);
      fail(error, "recent messages");
      return (data ?? []).map(mapMessage);
    },
    async addMessage(caseId, role, content, meta) {
      const { data, error } = await db
        .from("case_messages")
        .insert({
          case_id: caseId,
          company_id: companyId,
          role,
          content,
          channel: meta?.channel ?? "website",
          delivery: meta?.delivery ?? (role === "staff" ? "internal" : "delivered"),
          simulated: meta?.simulated ?? false,
        })
        .select("*")
        .single();
      fail(error, "message insert");
      return mapMessage(data!);
    },

    async listDocuments(caseId): Promise<CaseDocument[]> {
      let q = db.from("case_documents").select("*").eq("company_id", companyId).order("requested_at");
      if (caseId) q = q.eq("case_id", caseId);
      const { data, error } = await q;
      fail(error, "documents");
      return (data ?? []).map(mapDocument);
    },
    async getDocument(id) {
      const { data, error } = await db.from("case_documents").select("*").eq("company_id", companyId).eq("id", id).maybeSingle();
      fail(error, "document");
      return data ? mapDocument(data) : null;
    },
    async saveDocument(doc) {
      const row = {
        company_id: companyId,
        case_id: doc.caseId,
        kind: doc.kind,
        status: doc.status,
        file_name: doc.fileName,
        mime_type: doc.mimeType,
        size: doc.size,
        storage_path: doc.storagePath,
        requested_at: doc.requestedAt,
        received_at: doc.receivedAt,
      };
      const q = doc.id ? db.from("case_documents").update(row).eq("company_id", companyId).eq("id", doc.id) : db.from("case_documents").insert(row);
      const { data, error } = await q.select("*").single();
      fail(error, "document save");
      return mapDocument(data!);
    },

    async listFollowUps(caseId): Promise<FollowUp[]> {
      let q = db.from("follow_ups").select("*").eq("company_id", companyId).order("scheduled_for");
      if (caseId) q = q.eq("case_id", caseId);
      const { data, error } = await q;
      fail(error, "follow-ups");
      return (data ?? []).map(mapFollowUp);
    },
    async saveFollowUp(f) {
      const row = {
        company_id: companyId,
        case_id: f.caseId,
        kind: f.kind,
        message: f.message,
        scheduled_for: f.scheduledFor,
        status: f.status,
        sent_at: f.sentAt,
        note: f.note,
      };
      const q = f.id ? db.from("follow_ups").update(row).eq("company_id", companyId).eq("id", f.id) : db.from("follow_ups").insert(row);
      const { data, error } = await q.select("*").single();
      fail(error, "follow-up save");
      return mapFollowUp(data!);
    },

    async listQuestions() {
      const { data, error } = await db.from("assistant_questions").select("*").eq("company_id", companyId).order("position");
      fail(error, "questions");
      return (data ?? []).map(mapQuestion);
    },
    async saveQuestion(q) {
      const row: Row = {
        company_id: companyId,
        key: q.key,
        label: q.label,
        prompt: q.prompt,
        type: q.type,
        options: q.options,
        required: q.required,
        active: q.active,
      };
      if (q.position !== undefined) row.position = q.position;
      if (q.id) {
        const { data, error } = await db.from("assistant_questions").update(row).eq("company_id", companyId).eq("id", q.id).select("*").single();
        fail(error, "question update");
        return mapQuestion(data!);
      }
      if (row.position === undefined) {
        const existing = await store.listQuestions();
        row.position = existing.length;
      }
      const { data, error } = await db.from("assistant_questions").insert(row).select("*").single();
      fail(error, "question insert");
      return mapQuestion(data!);
    },
    async deleteQuestion(id) {
      const { error } = await db.from("assistant_questions").delete().eq("company_id", companyId).eq("id", id);
      fail(error, "question delete");
    },
    async reorderQuestions(orderedIds) {
      await Promise.all(
        orderedIds.map(async (id, position) => {
          const { error } = await db.from("assistant_questions").update({ position }).eq("company_id", companyId).eq("id", id);
          fail(error, "question reorder");
        }),
      );
    },
    async setActiveQuestionKeys(activeKeys) {
      const questions = await store.listQuestions();
      await Promise.all(
        questions.map(async (q) => {
          const active = activeKeys.includes(q.key);
          if (active === q.active) return;
          const { error } = await db.from("assistant_questions").update({ active }).eq("company_id", companyId).eq("id", q.id);
          fail(error, "question active");
        }),
      );
    },

    async getAssistant(): Promise<AssistantSettings> {
      const { data, error } = await db.from("assistant_settings").select("*").eq("company_id", companyId).single();
      fail(error, "assistant");
      const r = data!;
      return {
        name: r.name,
        greeting: r.greeting,
        tone: r.tone,
        autoReply: r.auto_reply,
        autoFollowUp: r.auto_followup,
        appointmentBooking: r.appointment_booking,
        humanHandoff: r.human_handoff,
      };
    },
    async saveAssistant(s) {
      const { error } = await db.from("assistant_settings").upsert({
        company_id: companyId,
        name: s.name,
        greeting: s.greeting,
        tone: s.tone,
        auto_reply: s.autoReply,
        auto_followup: s.autoFollowUp,
        appointment_booking: s.appointmentBooking,
        human_handoff: s.humanHandoff,
      });
      fail(error, "assistant save");
      return s;
    },

    async listAppointments() {
      const { data, error } = await db.from("appointments").select("*").eq("company_id", companyId).order("starts_at");
      fail(error, "appointments");
      return (data ?? []).map(mapAppointment);
    },
    async saveAppointment(a) {
      const row: Row = { company_id: companyId, case_id: a.caseId, title: a.title, starts_at: a.startsAt, duration_min: a.durationMin, notes: a.notes };
      if (a.status) row.status = a.status;
      const q = a.id
        ? db.from("appointments").update(row).eq("company_id", companyId).eq("id", a.id)
        : db.from("appointments").insert(row);
      const { data, error } = await q.select("*").single();
      fail(error, "appointment save");
      return mapAppointment(data!);
    },
    async deleteAppointment(id) {
      const { error } = await db.from("appointments").delete().eq("company_id", companyId).eq("id", id);
      fail(error, "appointment delete");
    },

    async listMembers() {
      const { data, error } = await db.from("company_members").select("*").eq("company_id", companyId).order("created_at");
      fail(error, "members");
      return (data ?? []).map(mapMember);
    },
    async inviteMember(email, role) {
      const { data, error } = await db
        .from("company_members")
        .insert({ company_id: companyId, email: email.toLowerCase(), role, status: "invited" })
        .select("*")
        .single();
      fail(error, "member invite");
      return mapMember(data!);
    },
    async updateMemberRole(id, role) {
      const { error } = await db.from("company_members").update({ role }).eq("company_id", companyId).eq("id", id);
      fail(error, "member role");
    },
    async removeMember(id) {
      const { error } = await db.from("company_members").delete().eq("company_id", companyId).eq("id", id);
      fail(error, "member remove");
    },

    async listChannels(): Promise<Channel[]> {
      const { data, error } = await db.from("channels").select("*").eq("company_id", companyId);
      fail(error, "channels");
      const rows = data ?? [];
      return CHANNEL_ORDER.map((kind) => {
        const r = rows.find((x) => x.kind === kind);
        return { kind, status: r?.status ?? (kind === "whatsapp" ? "coming_soon" : "disconnected"), account: r?.account ?? "" };
      });
    },
    async getSubscription() {
      const { data, error } = await db.from("subscriptions").select("*").eq("company_id", companyId).maybeSingle();
      fail(error, "subscription");
      return { plan: data?.plan ?? "starter", status: data?.status ?? "trialing", currentPeriodEnd: data?.current_period_end ?? null };
    },
    async getStats() {
      const [cases, appointments] = await Promise.all([store.listCases(), store.listAppointments()]);
      return computeStats(cases, appointments);
    },
  };
  return store;
}
