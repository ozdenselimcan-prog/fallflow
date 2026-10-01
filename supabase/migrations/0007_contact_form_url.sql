-- FallFlow: optionaler Link zu einem eigenen Kontaktformular des Büros. Wenn gesetzt, schickt die KI
-- ihn bei jeder neuen Kundenanfrage als Erstes mit, zusätzlich zu den normalen Erfassungsfragen.

alter table public.companies add column if not exists contact_form_url text not null default '';
