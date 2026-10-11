-- FallFlow: PDF-Vorlagen, die nur zur Information mitgeschickt werden (z. B. Preisliste, Datenschutzhinweis) und
-- nicht ausgefüllt zurückkommen müssen, sowie der Status "Antwort durch Büro nötig" (NEEDS_REPLY) für E-Mails, auf die
-- die KI bewusst nicht automatisch antwortet (Frage des Kunden, Rückrufwunsch, Leistung unklar).

alter table public.document_templates add column if not exists requires_return boolean not null default true;

alter table public.template_documents drop constraint if exists template_documents_status_check;
alter table public.template_documents add constraint template_documents_status_check
  check (status in ('sent', 'received', 'info'));

alter table public.cases drop constraint if exists cases_status_check;
alter table public.cases add constraint cases_status_check
  check (status in ('NEW', 'QUALIFYING', 'WAITING_FOR_CUSTOMER', 'NEEDS_REPLY', 'COMPLETE', 'READY_FOR_REVIEW', 'CONVERTED'));
