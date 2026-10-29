-- FallFlow: Betriebsprofil je Firma – Branche, Beschreibung, angeforderte Unterlagen und Themen, die der Betrieb selbst
-- beantwortet. Leistungen stehen weiter in companies.services, die abgefragten Angaben in assistant_questions.
alter table public.companies add column if not exists business_profile jsonb not null default '{}'::jsonb;
