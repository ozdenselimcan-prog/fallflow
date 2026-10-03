-- Individuell editierbarer Nachrichtentext pro Leistung (z. B. was die KI zusätzlich zur Vorlage schreibt).
create table public.service_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  service text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, service)
);

alter table public.service_messages enable row level security;

create policy service_messages_select on public.service_messages for select using (public.is_member(company_id));
create policy service_messages_write on public.service_messages for all
  using (public.has_role(company_id, array['OWNER', 'ADMIN']))
  with check (public.has_role(company_id, array['OWNER', 'ADMIN']));
