-- FallFlow: Büro-eigene PDF-Vorlagen (z. B. Vollmachten), je einer Leistung zugeordnet. Sobald die KI die
-- passende Leistung bei einer Kundenanfrage erkennt, schickt sie automatisch einen Download-Link mit.

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  service text not null,
  title text not null,
  file_name text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);
alter table public.document_templates enable row level security;
create policy document_templates_select on public.document_templates for select using (public.is_member(company_id));
create policy document_templates_write on public.document_templates for all
  using (public.has_role(company_id, array['OWNER', 'ADMIN'])) with check (public.has_role(company_id, array['OWNER', 'ADMIN']));
