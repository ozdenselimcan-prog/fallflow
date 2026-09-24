-- FallFlow: AI-Intake-Umbau
-- Neue Prozessstatus, Dokumente, Follow-ups, Kanal-Metadaten an Nachrichten, Terminstatus, privater Datei-Speicher.
-- Nach 0001_init.sql ausführen (SQL-Editor oder `supabase db push`). Bestehende Daten werden migriert.

-- ---------------------------------------------------------------------------
-- Fälle: neue Statuswerte, Quelle "phone", Upload-Token
-- ---------------------------------------------------------------------------

alter table public.cases drop constraint if exists cases_status_check;
update public.cases set status = case status
  when 'NEEDS_INFO' then 'QUALIFYING'
  when 'CONTACTED' then 'CONVERTED'
  when 'APPOINTMENT' then 'READY_FOR_REVIEW'
  when 'CLOSED' then 'CONVERTED'
  else status end;
alter table public.cases add constraint cases_status_check
  check (status in ('NEW', 'QUALIFYING', 'WAITING_FOR_CUSTOMER', 'COMPLETE', 'READY_FOR_REVIEW', 'CONVERTED'));

alter table public.cases drop constraint if exists cases_source_check;
alter table public.cases add constraint cases_source_check
  check (source in ('widget', 'email', 'whatsapp', 'phone', 'manual', 'demo'));

-- Geheimer Link-Token für den Kunden-Upload (nur Upload, kein Lesezugriff). Läuft ab.
alter table public.cases add column if not exists upload_token text unique;
alter table public.cases add column if not exists upload_token_expires_at timestamptz;

-- ---------------------------------------------------------------------------
-- Nachrichten: Rolle "staff" (Mitarbeiter/Telefonnotiz), Kanal, Zustellstatus, Simulation
-- ---------------------------------------------------------------------------

alter table public.case_messages drop constraint if exists case_messages_role_check;
alter table public.case_messages add constraint case_messages_role_check check (role in ('user', 'assistant', 'staff'));
alter table public.case_messages add column if not exists channel text not null default 'website'
  check (channel in ('website', 'email', 'whatsapp', 'phone'));
alter table public.case_messages add column if not exists delivery text not null default 'delivered'
  check (delivery in ('delivered', 'not_sent', 'internal'));
alter table public.case_messages add column if not exists simulated boolean not null default false;

-- ---------------------------------------------------------------------------
-- Termine: vorgeschlagen / bestätigt
-- ---------------------------------------------------------------------------

alter table public.appointments add column if not exists status text not null default 'confirmed'
  check (status in ('proposed', 'confirmed'));

-- ---------------------------------------------------------------------------
-- Dokumente (angefordert oder erhalten) und Follow-ups
-- ---------------------------------------------------------------------------

create table if not exists public.case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  company_id uuid not null,
  kind text not null check (kind in ('floorplan', 'energy_certificate', 'photos', 'other')),
  status text not null check (status in ('requested', 'received')),
  file_name text not null default '',
  mime_type text not null default '',
  size int not null default 0,
  -- Pfad im privaten Bucket "case-documents"; wird nie an Clients ausgeliefert
  storage_path text not null default '',
  requested_at timestamptz not null default now(),
  received_at timestamptz,
  foreign key (case_id, company_id) references public.cases (id, company_id) on delete cascade
);
create index if not exists case_documents_case_idx on public.case_documents (case_id);

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  company_id uuid not null,
  kind text not null check (kind in ('document', 'info')),
  message text not null,
  scheduled_for timestamptz not null,
  status text not null default 'planned' check (status in ('planned', 'sent', 'manual', 'cancelled')),
  sent_at timestamptz,
  note text not null default '',
  created_at timestamptz not null default now(),
  foreign key (case_id, company_id) references public.cases (id, company_id) on delete cascade
);
create index if not exists follow_ups_company_idx on public.follow_ups (company_id, status, scheduled_for);

alter table public.case_documents enable row level security;
alter table public.follow_ups enable row level security;

drop policy if exists case_documents_all on public.case_documents;
create policy case_documents_all on public.case_documents for all using (public.is_member(company_id)) with check (public.is_member(company_id));
drop policy if exists follow_ups_all on public.follow_ups;
create policy follow_ups_all on public.follow_ups for all using (public.is_member(company_id)) with check (public.is_member(company_id));

-- ---------------------------------------------------------------------------
-- Privater Datei-Speicher: kein öffentlicher Zugriff, keine Policies für anon/authenticated.
-- Zugriff ausschließlich über die Service Role (Upload-Route bzw. geschützte Download-Route).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('case-documents', 'case-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- ---------------------------------------------------------------------------
-- Standardfragen: neue Angaben (Eigentümerstatus, Straße, Etagen) für bestehende Büros nachziehen
-- ---------------------------------------------------------------------------

insert into public.assistant_questions (company_id, key, label, prompt, type, options, required, active, position)
select c.id, q.key, q.label, q.prompt, q.type, q.options, q.required, true, 0
from public.companies c
cross join (values
  ('ownerStatus', 'Eigentümerstatus', 'Sind Sie Eigentümer, Mieter oder Verwalter des Gebäudes?', 'choice', array['Eigentümer','Mieter','Verwalter','Sonstiges'], true),
  ('street', 'Straße', 'Wie lautet die Adresse des Gebäudes (Straße und Hausnummer)?', 'text', '{}'::text[], true),
  ('floors', 'Etagen', 'Wie viele Etagen (Vollgeschosse) hat das Gebäude?', 'number', '{}'::text[], false)
) as q(key, label, prompt, type, options, required)
on conflict (company_id, key) do nothing;

-- Reihenfolge der Standardfragen vereinheitlichen; eigene Fragen bleiben dahinter.
with std(key, pos) as (values
  ('service', 0), ('buildingType', 1), ('yearBuilt', 2), ('livingArea', 3), ('heating', 4), ('ownerStatus', 5),
  ('street', 6), ('postalCode', 7), ('floors', 8), ('name', 9), ('email', 10), ('phone', 11))
update public.assistant_questions q set position = s.pos from std s where q.key = s.key;
update public.assistant_questions set position = 100 + position
 where key not in ('service','buildingType','yearBuilt','livingArea','heating','ownerStatus','street','postalCode','floors','name','email','phone')
   and position < 100;

-- Standarddaten für neue Büros (ersetzt die Funktion aus 0001)
create or replace function public.seed_company_defaults(cid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.assistant_settings (company_id) values (cid) on conflict do nothing;
  insert into public.subscriptions (company_id) values (cid) on conflict do nothing;

  insert into public.channels (company_id, kind, status) values
    (cid, 'website', 'connected'),
    (cid, 'gmail', 'disconnected'),
    (cid, 'microsoft', 'disconnected'),
    (cid, 'whatsapp', 'coming_soon')
  on conflict do nothing;

  insert into public.assistant_questions (company_id, key, label, prompt, type, options, required, active, position) values
    (cid, 'service', 'Gewünschte Leistung', 'Welche Leistung möchten Sie anfragen?', 'choice',
      array['Energieberatung','iSFP','Energieausweis','Fördermittelberatung','Baubegleitung','Heizung','Sanierung','Sonstiges'], true, true, 0),
    (cid, 'buildingType', 'Gebäudetyp', 'Welche Art Gebäude ist es?', 'choice', array['Einfamilienhaus','Mehrfamilienhaus','Sonstiges'], true, true, 1),
    (cid, 'yearBuilt', 'Baujahr', 'Was ist das Baujahr des Gebäudes?', 'number', '{}', true, true, 2),
    (cid, 'livingArea', 'Wohnfläche', 'Wie groß ist die Wohnfläche in m²?', 'number', '{}', true, true, 3),
    (cid, 'heating', 'Heizung', 'Welche Heizung ist aktuell installiert?', 'choice',
      array['Gas','Öl','Wärmepumpe','Fernwärme','Holz/Pellets','Strom','Sonstiges'], true, true, 4),
    (cid, 'ownerStatus', 'Eigentümerstatus', 'Sind Sie Eigentümer, Mieter oder Verwalter des Gebäudes?', 'choice',
      array['Eigentümer','Mieter','Verwalter','Sonstiges'], true, true, 5),
    (cid, 'street', 'Straße', 'Wie lautet die Adresse des Gebäudes (Straße und Hausnummer)?', 'text', '{}', true, true, 6),
    (cid, 'postalCode', 'PLZ', 'In welcher Postleitzahl liegt das Gebäude?', 'postal', '{}', true, true, 7),
    (cid, 'floors', 'Etagen', 'Wie viele Etagen (Vollgeschosse) hat das Gebäude?', 'number', '{}', false, true, 8),
    (cid, 'name', 'Name', 'Wie lautet Ihr vollständiger Name?', 'text', '{}', true, true, 9),
    (cid, 'email', 'E-Mail', 'Unter welcher E-Mail-Adresse können wir Sie erreichen?', 'email', '{}', true, true, 10),
    (cid, 'phone', 'Telefonnummer', 'Unter welcher Telefonnummer erreichen wir Sie am besten?', 'phone', '{}', true, true, 11)
  on conflict do nothing;
end;
$$;

revoke all on function public.seed_company_defaults(uuid) from public, anon, authenticated;
