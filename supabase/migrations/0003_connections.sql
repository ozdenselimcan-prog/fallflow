-- FallFlow: Kanal-Verbindungen pro Kunde (Multi-Tenant-Integrationen)
-- Jedes Büro verbindet seine EIGENEN Postfächer/Kanäle. FallFlow selbst hat nur eine App-Identität
-- (GOOGLE_CLIENT_ID/SECRET, MICROSOFT_CLIENT_ID/SECRET, WHATSAPP_APP_SECRET als globale Vercel-Variablen);
-- die eigentlichen Zugangsdaten jedes Kunden liegen ausschließlich hier, verschlüsselt.
--
-- Sicherheitsmodell: RLS ist aktiv und hat BEWUSST KEINE Policies. Damit ist die Tabelle für die
-- Rollen "anon" und "authenticated" (Browser, auch eingeloggte Mitglieder) vollständig unsichtbar –
-- weder Zeilen noch Spalten. Zugriff ausschließlich über den Service-Role-Client, ausschließlich
-- serverseitig in API-Routen/Cron. Tokens werden zusätzlich anwendungsseitig verschlüsselt
-- (AES-256-GCM, src/lib/crypto.ts) und nie an den Client zurückgegeben.

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider text not null check (provider in ('gmail', 'microsoft', 'whatsapp')),
  status text not null default 'connected' check (status in ('connected', 'error', 'disconnected')),
  account_name text not null default '',
  account_email text not null default '',
  -- Verschlüsselt (siehe src/lib/crypto.ts); nie im Klartext, nie an den Client.
  access_token_enc text,
  refresh_token_enc text,
  expires_at timestamptz,
  -- z. B. { phoneNumberId, wabaId } bei WhatsApp, { historyId } bei Gmail, { deltaLink } bei Microsoft
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, provider)
);
create index if not exists connections_company_idx on public.connections (company_id);
-- WhatsApp-Webhooks kommen ohne Company-Kontext an; die Telefonnummer-ID aus metadata identifiziert das Büro.
create index if not exists connections_wa_phone_idx on public.connections (((metadata ->> 'phoneNumberId'))) where provider = 'whatsapp';

alter table public.connections enable row level security;
-- Keine Policies = kein Zugriff für anon/authenticated. Der Service-Role-Client umgeht RLS grundsätzlich.

revoke all on public.connections from anon, authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists connections_set_updated_at on public.connections;
create trigger connections_set_updated_at before update on public.connections
  for each row execute function public.set_updated_at();
