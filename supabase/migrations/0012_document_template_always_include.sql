-- Manche Vorlagen (z. B. eine Datenschutz-Einwilligung) sollen bei JEDER Anfrage mitgeschickt werden,
-- unabhaengig von der erkannten Leistung.
alter table public.document_templates add column always_include boolean not null default false;
