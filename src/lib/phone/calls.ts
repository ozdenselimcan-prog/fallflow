import { createAdminClient } from "@/lib/supabase/clients";
import { isSupabaseConfigured } from "@/lib/utils";

/**
 * Datenzugriff für den Telefon-Assistenten: Nummer ↔ Betrieb und die Anrufe (Dauer für das Minuten-Kontingent).
 * Läuft mit dem Service-Role-Client (Twilio-Webhooks haben keine Sitzung) – jede Abfrage ist auf einen Betrieb bzw.
 * eine Nummer begrenzt. Ohne Supabase (lokal, Tests) im Speicher.
 */

export interface PhoneCall {
  callSid: string;
  companyId: string;
  caseId: string | null;
  fromNumber: string;
  status: string;
  durationSec: number;
  startedAt: string;
}

export interface PhoneRepo {
  companyForNumber(number: string): Promise<string | null>;
  numberForCompany(companyId: string): Promise<string | null>;
  startCall(call: { callSid: string; companyId: string; fromNumber: string }): Promise<void>;
  getCall(callSid: string): Promise<PhoneCall | null>;
  setCase(callSid: string, caseId: string): Promise<void>;
  finishCall(callSid: string, status: string, durationSec: number): Promise<void>;
  /** Abgerechnete Minuten im laufenden Monat (jeder Anruf auf volle Minuten aufgerundet). */
  minutesThisMonth(companyId: string): Promise<number>;
  recentCalls(companyId: string, limit: number): Promise<PhoneCall[]>;
}

export const billedMinutes = (durationSec: number) => (durationSec > 0 ? Math.ceil(durationSec / 60) : 0);
const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

/* --------------------------------------- Speicher (lokal/Tests) --------------------------------------- */

const g = globalThis as unknown as { __phoneDb?: { numbers: Map<string, string>; calls: Map<string, PhoneCall> } };
const mem = () => (g.__phoneDb ??= { numbers: new Map(), calls: new Map() });

/** Nur für lokale Entwicklung/Tests: Nummer einem Betrieb zuordnen. */
export function assignMemoryNumber(number: string, companyId: string) {
  mem().numbers.set(number, companyId);
}

const memoryRepo: PhoneRepo = {
  async companyForNumber(number) {
    return mem().numbers.get(number) ?? null;
  },
  async numberForCompany(companyId) {
    return [...mem().numbers.entries()].find(([, c]) => c === companyId)?.[0] ?? null;
  },
  async startCall({ callSid, companyId, fromNumber }) {
    if (!mem().calls.has(callSid)) mem().calls.set(callSid, { callSid, companyId, fromNumber, caseId: null, status: "in-progress", durationSec: 0, startedAt: new Date().toISOString() });
  },
  async getCall(callSid) {
    return mem().calls.get(callSid) ?? null;
  },
  async setCase(callSid, caseId) {
    const c = mem().calls.get(callSid);
    if (c) c.caseId = caseId;
  },
  async finishCall(callSid, status, durationSec) {
    const c = mem().calls.get(callSid);
    if (c) Object.assign(c, { status, durationSec });
  },
  async minutesThisMonth(companyId) {
    const from = monthStart();
    return [...mem().calls.values()].filter((c) => c.companyId === companyId && c.startedAt >= from).reduce((n, c) => n + billedMinutes(c.durationSec), 0);
  },
  async recentCalls(companyId, limit) {
    return [...mem().calls.values()].filter((c) => c.companyId === companyId).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit);
  },
};

/* ------------------------------------------- Supabase ------------------------------------------- */

type Row = Record<string, unknown>;
const mapCall = (r: Row): PhoneCall => ({
  callSid: String(r.call_sid),
  companyId: String(r.company_id),
  caseId: (r.case_id as string | null) ?? null,
  fromNumber: String(r.from_number ?? ""),
  status: String(r.status ?? ""),
  durationSec: Number(r.duration_sec ?? 0),
  startedAt: String(r.started_at),
});

export function phoneRepo(): PhoneRepo | null {
  if (!isSupabaseConfigured()) return memoryRepo;
  const db = createAdminClient();
  if (!db) return null;
  return {
    async companyForNumber(number) {
      const { data } = await db.from("phone_numbers").select("company_id").eq("number", number).maybeSingle();
      return (data?.company_id as string | undefined) ?? null;
    },
    async numberForCompany(companyId) {
      const { data } = await db.from("phone_numbers").select("number").eq("company_id", companyId).maybeSingle();
      return (data?.number as string | undefined) ?? null;
    },
    async startCall({ callSid, companyId, fromNumber }) {
      await db.from("phone_calls").upsert({ call_sid: callSid, company_id: companyId, from_number: fromNumber.slice(0, 40) }, { onConflict: "call_sid", ignoreDuplicates: true });
    },
    async getCall(callSid) {
      const { data } = await db.from("phone_calls").select("*").eq("call_sid", callSid).maybeSingle();
      return data ? mapCall(data) : null;
    },
    async setCase(callSid, caseId) {
      await db.from("phone_calls").update({ case_id: caseId }).eq("call_sid", callSid);
    },
    async finishCall(callSid, status, durationSec) {
      await db.from("phone_calls").update({ status: status.slice(0, 30), duration_sec: Math.max(0, Math.round(durationSec)), ended_at: new Date().toISOString() }).eq("call_sid", callSid);
    },
    async minutesThisMonth(companyId) {
      const { data } = await db.from("phone_calls").select("duration_sec").eq("company_id", companyId).gte("started_at", monthStart());
      return (data ?? []).reduce((n, r) => n + billedMinutes(Number(r.duration_sec ?? 0)), 0);
    },
    async recentCalls(companyId, limit) {
      const { data } = await db.from("phone_calls").select("*").eq("company_id", companyId).order("started_at", { ascending: false }).limit(limit);
      return (data ?? []).map(mapCall);
    },
  };
}
