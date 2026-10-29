-- FallFlow: Outlook-Kalender als eigene Verbindung (getrennt vom E-Mail-Postfach "microsoft").
alter table public.connections drop constraint if exists connections_provider_check;
alter table public.connections add constraint connections_provider_check check (provider in ('gmail', 'microsoft', 'whatsapp', 'outlook_calendar'));
