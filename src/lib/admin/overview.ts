import type { Subscription } from "@/lib/data/types";
import { needsPaymentSetup, trialDaysLeft } from "@/lib/billing/access";
import { createAdminClient } from "@/lib/supabase/clients";

/** Ab wann ein Postfach als "hängt" gilt, wenn der letzte erfolgreiche Abruf so lange her ist. */
export const STALE_SYNC_MS = 3 * 60 * 60 * 1000;

/** Betreiber dieses FallFlow (Komma-getrennte Login-Adressen in ADMIN_EMAILS). */
export function isPlatformAdmin(email: string): boolean {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}

export interface CompanyRow {
  id: string;
  name: string;
  owner: string;
  createdAt: string;
  onboarded: boolean;
  plan: string;
  status: string;
  hasPayment: boolean;
  needsPayment: boolean;
  /** Resttage der Testphase ohne Zahlungsmethode (null = nicht in so einer Testphase) */
  trialDaysLeft: number | null;
  periodEnd: string | null;
  canceledAt: string | null;
  mailbox: { provider: string; account: string; status: string; lastSyncedAt: string | null; lastError: string; stale: boolean } | null;
  cases30d: number;
  casesTotal: number;
  lastActivity: string | null;
}

export interface MailHealth {
  ok: boolean;
  mailboxes: number;
  errors: number;
  stale: number;
}

const isStale = (lastSyncedAt: string | null, now: number) => !lastSyncedAt || now - Date.parse(lastSyncedAt) > STALE_SYNC_MS;

/** Gesundheit des Mail-Abrufs über alle Büros (für /api/health und die Übersicht). */
export async function mailHealth(now = Date.now()): Promise<MailHealth | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.from("connections").select("company_id, status, last_synced_at").in("provider", ["gmail", "microsoft"]).in("status", ["connected", "error"]);
  if (error) throw new Error(error.message);
  // Nur Postfächer bewerten, die der Mail-Abruf auch bearbeitet: Bei gekündigtem Abo oder abgelaufener Testphase ohne
  // Zahlungsmethode überspringt er sie absichtlich (siehe mail-sync.ts) – sonst meldet der Check dauerhaft "veraltet".
  const ids = [...new Set((data ?? []).map((r) => r.company_id as string))];
  const [subs, comps] = ids.length
    ? await Promise.all([
        admin.from("subscriptions").select("company_id, status, stripe_customer_id, current_period_end").in("company_id", ids),
        admin.from("companies").select("id, created_at").in("id", ids),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (subs.error || comps.error) throw new Error((subs.error ?? comps.error)!.message);
  const subOf = new Map((subs.data ?? []).map((s) => [s.company_id as string, s]));
  const createdOf = new Map((comps.data ?? []).map((c) => [c.id as string, c.created_at as string]));
  const active = (companyId: string) => {
    const s = subOf.get(companyId);
    const createdAt = createdOf.get(companyId);
    if (!s || !createdAt) return true;
    if (s.status === "canceled") return false;
    const sub = { status: s.status as Subscription["status"], stripeCustomerId: s.stripe_customer_id as string | null, currentPeriodEnd: s.current_period_end as string | null };
    return !needsPaymentSetup({ createdAt }, sub, now);
  };
  const rows = (data ?? []).filter((r) => active(r.company_id as string));
  const errors = rows.filter((r) => r.status === "error").length;
  const stale = rows.filter((r) => r.status === "connected" && isStale(r.last_synced_at, now)).length;
  return { ok: errors === 0 && stale === 0, mailboxes: rows.length, errors, stale };
}

/** Alle Büros mit Abo, Postfach und Aktivität – nur für die Betreiber-Übersicht. */
export async function loadCompanyOverview(now = Date.now()): Promise<CompanyRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const since30 = new Date(now - 30 * 86_400_000).toISOString();
  const [companies, subs, members, conns, cases] = await Promise.all([
    admin.from("companies").select("id, name, created_at, onboarding_completed").order("created_at", { ascending: false }),
    admin.from("subscriptions").select("company_id, plan, status, stripe_customer_id, current_period_end, canceled_at"),
    admin.from("company_members").select("company_id, email, role").eq("role", "OWNER"),
    admin.from("connections").select("company_id, provider, account_email, status, last_synced_at, last_error").in("provider", ["gmail", "microsoft"]),
    admin.from("cases").select("company_id, created_at, updated_at").limit(20000),
  ]);
  for (const r of [companies, subs, members, conns, cases]) if (r.error) throw new Error(r.error.message);

  const subOf = new Map((subs.data ?? []).map((s) => [s.company_id as string, s]));
  const ownerOf = new Map((members.data ?? []).map((m) => [m.company_id as string, m.email as string]));
  const connOf = new Map((conns.data ?? []).filter((c) => c.status !== "disconnected").map((c) => [c.company_id as string, c]));
  const caseStats = new Map<string, { total: number; recent: number; last: string | null }>();
  for (const c of cases.data ?? []) {
    const s = caseStats.get(c.company_id) ?? { total: 0, recent: 0, last: null };
    s.total++;
    if (c.created_at >= since30) s.recent++;
    if (!s.last || c.updated_at > s.last) s.last = c.updated_at;
    caseStats.set(c.company_id, s);
  }

  return (companies.data ?? []).map((c): CompanyRow => {
    const sub = subOf.get(c.id);
    const conn = connOf.get(c.id);
    const stats = caseStats.get(c.id);
    const hasPayment = Boolean(sub?.stripe_customer_id);
    return {
      id: c.id,
      name: c.name,
      owner: ownerOf.get(c.id) ?? "",
      createdAt: c.created_at,
      onboarded: c.onboarding_completed,
      plan: sub?.plan ?? "starter",
      status: sub?.status ?? "trialing",
      hasPayment,
      // Testphase ohne Zahlungsmethode: Resttage bzw. abgelaufen (siehe lib/billing/access.ts)
      ...(() => {
        const s = { stripeCustomerId: sub?.stripe_customer_id ?? null, status: (sub?.status ?? "trialing") as Subscription["status"], currentPeriodEnd: sub?.current_period_end ?? null };
        const left = trialDaysLeft({ createdAt: c.created_at }, s);
        return { needsPayment: needsPaymentSetup({ createdAt: c.created_at }, s), trialDaysLeft: left };
      })(),
      periodEnd: sub?.current_period_end ?? null,
      canceledAt: sub?.canceled_at ?? null,
      mailbox: conn
        ? { provider: conn.provider, account: conn.account_email, status: conn.status, lastSyncedAt: conn.last_synced_at, lastError: conn.last_error ?? "", stale: conn.status === "connected" && isStale(conn.last_synced_at, now) }
        : null,
      cases30d: stats?.recent ?? 0,
      casesTotal: stats?.total ?? 0,
      lastActivity: stats?.last ?? null,
    };
  });
}

export interface WhatsAppRequestRow {
  companyId: string;
  company: string;
  request: import("@/lib/data/types").WhatsAppAccessRequest;
}

/** Offene und erledigte WhatsApp-Freischaltungen (siehe lib/whatsapp-access.ts), neueste zuerst. */
export async function loadWhatsAppRequests(): Promise<WhatsAppRequestRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin.from("companies").select("id, name, business_profile").not("business_profile->whatsappRequest", "is", null);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((c) => ({ companyId: c.id as string, company: c.name as string, request: (c.business_profile as { whatsappRequest: WhatsAppRequestRow["request"] }).whatsappRequest }))
    .sort((a, b) => b.request.requestedAt.localeCompare(a.request.requestedAt));
}
