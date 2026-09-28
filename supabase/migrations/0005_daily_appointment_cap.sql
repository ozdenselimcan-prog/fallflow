-- FallFlow: Obergrenze für Termine pro Tag (unabhängig von der Termindauer).
-- null = unbegrenzt, nur durch Bürozeiten/Termindauer begrenzt.

alter table public.assistant_settings add column if not exists max_appointments_per_day int check (max_appointments_per_day is null or max_appointments_per_day between 1 and 50);
