-- FallFlow: Rückweg der Büro-PDF-Vorlagen. Sobald eine Vorlage an einen Fall gesendet wird, entsteht hier
-- ein Eintrag (status 'sent'); lädt der Kunde die ausgefüllte Version wieder hoch, wird er auf 'received'
-- gesetzt. Der Fall gilt erst als bereit zur Prüfung, wenn alle gesendeten Vorlagen zurück sind.

create table public.template_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  template_id uuid not null references public.document_templates (id) on delete cascade,
  status text not null default 'sent' check (status in ('sent', 'received')),
  storage_path text not null default '',
  ai_note text not null default '',
  created_at timestamptz not null default now(),
  received_at timestamptz
);
alter table public.template_documents enable row level security;
create policy template_documents_all on public.template_documents for all using (public.is_member(company_id)) with check (public.is_member(company_id));
