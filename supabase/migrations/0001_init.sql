-- FallFlow: Initiales Schema mit Mandantentrennung (Row Level Security)
-- Ausführen im Supabase SQL-Editor oder per `supabase db push`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text not null default '',
  phone text not null default '',
  address text not null default '',
  services text[] not null default '{}',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null default 'MEMBER' check (role in ('OWNER', 'ADMIN', 'MEMBER')),
  status text not null default 'active' check (status in ('active', 'invited')),
  created_at timestamptz not null default now(),
  unique (company_id, email)
);
create index company_members_user_idx on public.company_members (user_id);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  status text not null default 'NEW' check (status in ('NEW', 'NEEDS_INFO', 'COMPLETE', 'CONTACTED', 'APPOINTMENT', 'CLOSED')),
  completeness int not null default 0 check (completeness between 0 and 100),
  customer_name text not null default '',
  service text not null default '',
  source text not null default 'widget' check (source in ('widget', 'email', 'whatsapp', 'manual', 'demo')),
  summary text not null default '',
  assigned_to uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create index cases_company_idx on public.cases (company_id, created_at desc);

create table public.case_fields (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  company_id uuid not null,
  key text not null,
  value text not null default '',
  unique (case_id, key),
  foreign key (case_id, company_id) references public.cases (id, company_id) on delete cascade
);

create table public.case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  company_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now(),
  foreign key (case_id, company_id) references public.cases (id, company_id) on delete cascade
);
create index case_messages_case_idx on public.case_messages (case_id, created_at);

create table public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  company_id uuid not null,
  type text not null,
  text text not null,
  created_at timestamptz not null default now(),
  foreign key (case_id, company_id) references public.cases (id, company_id) on delete cascade
);
create index case_events_case_idx on public.case_events (case_id, created_at);

create table public.assistant_settings (
  company_id uuid primary key references public.companies (id) on delete cascade,
  name text not null default 'Anna',
  greeting text not null default 'Hallo! Wie können wir Ihnen bei Ihrem Gebäude helfen?',
  tone text not null default 'friendly' check (tone in ('professional', 'friendly', 'short')),
  auto_reply boolean not null default true,
  auto_followup boolean not null default true,
  appointment_booking boolean not null default true,
  human_handoff boolean not null default true
);

create table public.assistant_questions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  key text not null,
  label text not null,
  prompt text not null,
  type text not null check (type in ('choice', 'number', 'text', 'email', 'phone', 'postal')),
  options text[] not null default '{}',
  required boolean not null default false,
  active boolean not null default true,
  position int not null default 0,
  unique (company_id, key)
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null check (kind in ('website', 'gmail', 'microsoft', 'whatsapp')),
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'coming_soon')),
  account text not null default '',
  -- OAuth-Tokens gehören NICHT in diese Tabelle (Client-lesbar). Später: token_ref auf Secrets-Manager/Vault.
  token_ref text,
  unique (company_id, kind)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  case_id uuid,
  title text not null,
  starts_at timestamptz not null,
  duration_min int not null default 60 check (duration_min between 5 and 1440),
  notes text not null default '',
  created_at timestamptz not null default now(),
  foreign key (case_id, company_id) references public.cases (id, company_id) on delete set null (case_id)
);
create index appointments_company_idx on public.appointments (company_id, starts_at);

create table public.subscriptions (
  company_id uuid primary key references public.companies (id) on delete cascade,
  plan text not null default 'starter' check (plan in ('starter', 'pro', 'business')),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text
);

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen für RLS (security definer, damit keine Policy-Rekursion entsteht)
-- ---------------------------------------------------------------------------

create or replace function public.is_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members
    where company_id = cid and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.has_role(cid uuid, roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members
    where company_id = cid and user_id = auth.uid() and status = 'active' and role = any (roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.cases enable row level security;
alter table public.case_fields enable row level security;
alter table public.case_messages enable row level security;
alter table public.case_events enable row level security;
alter table public.assistant_settings enable row level security;
alter table public.assistant_questions enable row level security;
alter table public.channels enable row level security;
alter table public.appointments enable row level security;
alter table public.subscriptions enable row level security;

-- profiles: nur das eigene Profil
create policy profiles_select_own on public.profiles for select using (id = auth.uid());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- companies: Mitglieder lesen, Owner/Admin ändern (Anlage nur über Trigger)
create policy companies_select on public.companies for select using (public.is_member(id));
create policy companies_update on public.companies for update
  using (public.has_role(id, array['OWNER', 'ADMIN'])) with check (public.has_role(id, array['OWNER', 'ADMIN']));

-- company_members: Mitglieder lesen, Owner/Admin verwalten (Rolle OWNER kann nur ein Owner vergeben)
create policy members_select on public.company_members for select using (public.is_member(company_id));
create policy members_insert on public.company_members for insert
  with check (public.has_role(company_id, array['OWNER', 'ADMIN']) and role <> 'OWNER' and status = 'invited' and user_id is null);
create policy members_update on public.company_members for update
  using (public.has_role(company_id, array['OWNER', 'ADMIN']) and role <> 'OWNER')
  with check (public.has_role(company_id, array['OWNER', 'ADMIN']) and role <> 'OWNER');
create policy members_delete on public.company_members for delete
  using (public.has_role(company_id, array['OWNER', 'ADMIN']) and role <> 'OWNER');

-- Tenant-Daten, die alle Mitglieder bearbeiten dürfen
create policy cases_all on public.cases for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create policy case_fields_all on public.case_fields for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create policy case_messages_all on public.case_messages for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create policy case_events_all on public.case_events for all using (public.is_member(company_id)) with check (public.is_member(company_id));
create policy appointments_all on public.appointments for all using (public.is_member(company_id)) with check (public.is_member(company_id));

-- Konfiguration: Mitglieder lesen, Owner/Admin schreiben
create policy assistant_settings_select on public.assistant_settings for select using (public.is_member(company_id));
create policy assistant_settings_write on public.assistant_settings for all
  using (public.has_role(company_id, array['OWNER', 'ADMIN'])) with check (public.has_role(company_id, array['OWNER', 'ADMIN']));
create policy assistant_questions_select on public.assistant_questions for select using (public.is_member(company_id));
create policy assistant_questions_write on public.assistant_questions for all
  using (public.has_role(company_id, array['OWNER', 'ADMIN'])) with check (public.has_role(company_id, array['OWNER', 'ADMIN']));
create policy channels_select on public.channels for select using (public.is_member(company_id));
create policy channels_write on public.channels for all
  using (public.has_role(company_id, array['OWNER', 'ADMIN'])) with check (public.has_role(company_id, array['OWNER', 'ADMIN']));

-- subscriptions: nur lesen; Schreiben ausschließlich per Service Role (Stripe-Webhook)
create policy subscriptions_select on public.subscriptions for select using (public.is_member(company_id));

-- ---------------------------------------------------------------------------
-- Standarddaten pro Company + Signup-Trigger
-- ---------------------------------------------------------------------------

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
    (cid, 'service', 'Anliegen', 'Welche Leistung möchten Sie anfragen?', 'choice',
      array['Energieberatung','iSFP','Energieausweis','Fördermittelberatung','Baubegleitung','Heizung','Sanierung','Sonstiges'], true, true, 0),
    (cid, 'buildingType', 'Gebäudeart', 'Welche Art Gebäude möchten Sie sanieren?', 'choice',
      array['Einfamilienhaus','Mehrfamilienhaus','Sonstiges'], true, true, 1),
    (cid, 'yearBuilt', 'Baujahr', 'Was ist das Baujahr des Gebäudes?', 'number', '{}', true, true, 2),
    (cid, 'livingArea', 'Wohnfläche', 'Wie groß ist die Wohnfläche in m²?', 'number', '{}', true, true, 3),
    (cid, 'heating', 'Heizung', 'Welche Heizung ist aktuell installiert?', 'choice',
      array['Gas','Öl','Wärmepumpe','Fernwärme','Holz/Pellets','Strom','Sonstiges'], false, true, 4),
    (cid, 'postalCode', 'PLZ', 'In welcher Postleitzahl liegt das Gebäude?', 'postal', '{}', true, true, 5),
    (cid, 'name', 'Name', 'Wie lautet Ihr vollständiger Name?', 'text', '{}', true, true, 6),
    (cid, 'email', 'E-Mail', 'Unter welcher E-Mail-Adresse können wir Sie erreichen?', 'email', '{}', true, true, 7),
    (cid, 'phone', 'Telefonnummer', 'Unter welcher Telefonnummer erreichen wir Sie am besten?', 'phone', '{}', false, true, 8)
  on conflict do nothing;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
  full_name text;
  matched int;
begin
  full_name := trim(coalesce(new.raw_user_meta_data ->> 'first_name', '') || ' ' || coalesce(new.raw_user_meta_data ->> 'last_name', ''));

  insert into public.profiles (id, first_name, last_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'first_name', ''), coalesce(new.raw_user_meta_data ->> 'last_name', ''), coalesce(new.email, ''));

  -- Einladung vorhanden? Dann dem bestehenden Büro beitreten, sonst neues Büro anlegen.
  update public.company_members
     set user_id = new.id, status = 'active', name = full_name
   where user_id is null and lower(email) = lower(coalesce(new.email, ''));
  get diagnostics matched = row_count;

  if matched = 0 then
    insert into public.companies (name)
    values (coalesce(nullif(trim(new.raw_user_meta_data ->> 'company'), ''), 'Mein Büro'))
    returning id into cid;

    insert into public.company_members (company_id, user_id, email, name, role, status)
    values (cid, new.id, coalesce(new.email, ''), full_name, 'OWNER', 'active');

    perform public.seed_company_defaults(cid);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Funktionen nicht öffentlich aufrufbar machen
revoke all on function public.seed_company_defaults(uuid) from public, anon, authenticated;
