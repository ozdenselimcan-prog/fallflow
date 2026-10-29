-- FallFlow: Telefon-Assistent.
-- phone_numbers: welche FlowDesk-Nummer (Twilio) zu welchem Betrieb gehört. Nur der Betreiber (Service Role) trägt
-- Nummern ein – Betriebe können sie sehen, aber nicht ändern (sonst könnte ein Betrieb fremde Anrufe auf sich lenken).
-- phone_calls: jeder Anruf mit Dauer, für das Minuten-Kontingent und den Verlauf.

create table if not exists public.phone_numbers (
  number text primary key,
  company_id uuid not null unique references public.companies(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.phone_numbers enable row level security;
drop policy if exists phone_numbers_select on public.phone_numbers;
create policy phone_numbers_select on public.phone_numbers for select using (public.is_member(company_id));

create table if not exists public.phone_calls (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  call_sid text not null unique,
  case_id uuid references public.cases(id) on delete set null,
  from_number text not null default '',
  status text not null default 'in-progress',
  duration_sec integer not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists phone_calls_company_started on public.phone_calls (company_id, started_at desc);
alter table public.phone_calls enable row level security;
drop policy if exists phone_calls_select on public.phone_calls;
create policy phone_calls_select on public.phone_calls for select using (public.is_member(company_id));
