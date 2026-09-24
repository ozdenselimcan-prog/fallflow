import type { Session } from "@/lib/auth/session";
import { createAdminClient, createUserClient } from "@/lib/supabase/clients";
import { isSupabaseConfigured } from "@/lib/utils";
import { createMemoryStore, findMemoryCaseByToken } from "./memory";
import type { Store } from "./store";
import { createSupabaseStore } from "./supabase";
import type { CaseRecord } from "./types";

/** Store für den eingeloggten Benutzer (RLS). */
export async function getStore(session: Session): Promise<Store> {
  if (session.demo) return createMemoryStore();
  return createSupabaseStore(await createUserClient(), session.companyId);
}

/**
 * Store für öffentliche Endpunkte (Widget, Webhooks). Nutzt den Service-Role-Client
 * und ist deshalb hart auf eine Company begrenzt. Gibt null zurück, wenn die Company
 * nicht existiert oder der Service-Role-Key fehlt.
 */
export async function getPublicStore(companyId: string): Promise<Store | null> {
  if (!isSupabaseConfigured()) return createMemoryStore();
  const admin = createAdminClient();
  if (!admin || companyId === "demo") return null;
  const { data } = await admin.from("companies").select("id").eq("id", companyId).maybeSingle();
  return data ? createSupabaseStore(admin, companyId) : null;
}

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{16,64}$/;

export interface UploadContext {
  store: Store;
  caseRecord: CaseRecord;
}

/**
 * Löst einen Upload-Token auf (öffentlicher Kunden-Link). Liefert den auf genau diese Company begrenzten Store
 * und den Fall – oder null bei unbekanntem/abgelaufenem Token. Der Token berechtigt nur zum Hochladen.
 */
export async function findUploadContext(token: string): Promise<UploadContext | null> {
  if (!TOKEN_FORMAT.test(token)) return null;
  let store: Store;
  let caseId: string;
  if (!isSupabaseConfigured()) {
    const c = findMemoryCaseByToken(token);
    if (!c) return null;
    store = createMemoryStore();
    caseId = c.id;
  } else {
    const admin = createAdminClient();
    if (!admin) return null;
    const { data } = await admin.from("cases").select("id, company_id").eq("upload_token", token).maybeSingle();
    if (!data) return null;
    store = createSupabaseStore(admin, data.company_id);
    caseId = data.id;
  }
  const caseRecord = await store.getCase(caseId);
  if (!caseRecord || !caseRecord.uploadTokenExpiresAt || Date.parse(caseRecord.uploadTokenExpiresAt) < Date.now()) return null;
  return { store, caseRecord };
}

/** Alle Mandanten-Stores (nur für den Cron-Job, Service Role). */
export async function listAllStores(): Promise<Store[]> {
  if (!isSupabaseConfigured()) return [createMemoryStore()];
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin.from("companies").select("id");
  return (data ?? []).map((c) => createSupabaseStore(admin, c.id as string));
}
