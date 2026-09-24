import type { Session } from "@/lib/auth/session";
import { createAdminClient, createUserClient } from "@/lib/supabase/clients";
import { isSupabaseConfigured } from "@/lib/utils";
import { createMemoryStore } from "./memory";
import type { Store } from "./store";
import { createSupabaseStore } from "./supabase";

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
