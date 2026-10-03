import { createAdminClient } from "@/lib/supabase/clients";
import { isSupabaseConfigured } from "@/lib/utils";
import { decryptSecret, encryptionAvailable, encryptSecret } from "@/lib/crypto";

/**
 * Verwaltet die Tabelle `connections` (Kanal-Zugangsdaten pro Büro). Ausschließlich über den
 * Service-Role-Client – die Tabelle hat keine RLS-Policies und ist für Browser-Clients unsichtbar.
 * Tokens werden vor dem Schreiben verschlüsselt und beim Lesen entschlüsselt; sie verlassen dieses
 * Modul nie unverschlüsselt in Richtung Client (siehe `toStatus`, das nur sichere Felder exportiert).
 */

export type ConnectionProvider = "gmail" | "microsoft";

export interface Connection {
  id: string;
  companyId: string;
  provider: ConnectionProvider;
  status: "connected" | "error" | "disconnected";
  accountName: string;
  accountEmail: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
  lastSyncedAt: string | null;
  lastError: string;
  updatedAt: string;
}

/** Sicher an den Client sendbarer Ausschnitt – niemals Tokens. */
export interface ConnectionStatus {
  provider: ConnectionProvider;
  status: "connected" | "error" | "disconnected";
  accountName: string;
  accountEmail: string;
  lastSyncedAt: string | null;
  lastError: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function mapRow(r: Row): Connection {
  return {
    id: r.id,
    companyId: r.company_id,
    provider: r.provider,
    status: r.status,
    accountName: r.account_name ?? "",
    accountEmail: r.account_email ?? "",
    accessToken: r.access_token_enc ? decryptSecret(r.access_token_enc) : null,
    refreshToken: r.refresh_token_enc ? decryptSecret(r.refresh_token_enc) : null,
    expiresAt: r.expires_at,
    metadata: r.metadata ?? {},
    lastSyncedAt: r.last_synced_at,
    lastError: r.last_error ?? "",
    updatedAt: r.updated_at,
  };
}

export const toStatus = (c: Pick<Connection, "provider" | "status" | "accountName" | "accountEmail" | "lastSyncedAt" | "lastError">): ConnectionStatus => ({
  provider: c.provider,
  status: c.status,
  accountName: c.accountName,
  accountEmail: c.accountEmail,
  lastSyncedAt: c.lastSyncedAt,
  lastError: c.lastError,
});

function admin() {
  const client = createAdminClient();
  if (!client) throw new Error("Service-Role-Key fehlt – Kanal-Verbindungen sind nicht verfügbar.");
  return client;
}

/** Demo-Modus (kein Supabase konfiguriert): Kanal-Verbindungen gibt es nicht, statt eines Fehlers gilt „nicht verbunden“. */
export async function getConnection(companyId: string, provider: ConnectionProvider): Promise<Connection | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await admin().from("connections").select("*").eq("company_id", companyId).eq("provider", provider).maybeSingle();
  if (error) {
    console.error("[connections] get:", error.message);
    return null;
  }
  return data ? mapRow(data) : null;
}

/** Alle aktiven Verbindungen eines Anbieters, büroübergreifend (für Cron-Sync). */
export async function listActiveConnections(provider: ConnectionProvider): Promise<Connection[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await admin().from("connections").select("*").eq("provider", provider).eq("status", "connected");
  if (error) {
    console.error("[connections] list:", error.message);
    return [];
  }
  return (data ?? []).map(mapRow);
}

export async function listConnections(companyId: string): Promise<Connection[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await admin().from("connections").select("*").eq("company_id", companyId);
  if (error) {
    console.error("[connections] list company:", error.message);
    return [];
  }
  return (data ?? []).map(mapRow);
}

export interface SaveConnectionInput {
  companyId: string;
  provider: ConnectionProvider;
  status?: Connection["status"];
  accountName?: string;
  accountEmail?: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
  lastSyncedAt?: string | null;
  lastError?: string;
}

export async function saveConnection(input: SaveConnectionInput): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Kanal-Verbindungen sind im Demo-Modus nicht verfügbar.");
  if (!encryptionAvailable() && (input.accessToken || input.refreshToken)) {
    throw new Error("CONNECTIONS_SECRET ist nicht gesetzt – Zugangsdaten können nicht sicher gespeichert werden.");
  }
  const row: Row = { company_id: input.companyId, provider: input.provider };
  if (input.status) row.status = input.status;
  if (input.accountName !== undefined) row.account_name = input.accountName;
  if (input.accountEmail !== undefined) row.account_email = input.accountEmail;
  if (input.accessToken !== undefined) row.access_token_enc = input.accessToken ? encryptSecret(input.accessToken) : null;
  if (input.refreshToken !== undefined) row.refresh_token_enc = input.refreshToken ? encryptSecret(input.refreshToken) : null;
  if (input.expiresAt !== undefined) row.expires_at = input.expiresAt;
  if (input.metadata !== undefined) row.metadata = input.metadata;
  if (input.lastSyncedAt !== undefined) row.last_synced_at = input.lastSyncedAt;
  if (input.lastError !== undefined) row.last_error = input.lastError;
  const { error } = await admin().from("connections").upsert(row, { onConflict: "company_id,provider" });
  if (error) throw new Error(`Verbindung konnte nicht gespeichert werden: ${error.message}`);
}

export async function deleteConnection(companyId: string, provider: ConnectionProvider): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await admin().from("connections").delete().eq("company_id", companyId).eq("provider", provider);
  if (error) throw new Error(`Verbindung konnte nicht getrennt werden: ${error.message}`);
}
