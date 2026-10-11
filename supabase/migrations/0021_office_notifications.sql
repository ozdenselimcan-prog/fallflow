-- FallFlow: E-Mail-Benachrichtigungen an das Büro ("Aufmerksamkeit benötigt" und "Fall bereit zur Prüfung").
-- notify_email leer = an alle Inhaber und Admins des Büros.

alter table public.assistant_settings add column if not exists notify_attention boolean not null default true;
alter table public.assistant_settings add column if not exists notify_ready boolean not null default true;
alter table public.assistant_settings add column if not exists notify_email text not null default '';
