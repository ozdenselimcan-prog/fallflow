-- FallFlow: Konfigurierbare Verfügbarkeit für die automatische Terminvorschlagsfunktion.
-- Die KI schlägt Termine nur innerhalb dieser Arbeitszeiten vor und nur an Tagen, die der Kunde selbst nennt.

alter table public.assistant_settings add column if not exists working_days int[] not null default '{1,2,3,4,5}';
alter table public.assistant_settings add column if not exists slot_start text not null default '09:00';
alter table public.assistant_settings add column if not exists slot_end text not null default '17:00';
alter table public.assistant_settings add column if not exists slot_minutes int not null default 60 check (slot_minutes between 15 and 480);
