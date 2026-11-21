-- FallFlow: Weiterleitung an eine eigene FallFlow-Adresse (z. B. huber-k3f9@in.fallflow.eu) statt Postfach-Verbindung.
-- Eigene Verbindungsart "forward"; metadata.address = Teil vor dem @ (eindeutig, darüber wird der Betrieb gefunden).
alter table public.connections drop constraint if exists connections_provider_check;
alter table public.connections add constraint connections_provider_check check (provider in ('gmail', 'microsoft', 'whatsapp', 'outlook_calendar', 'forward'));
create unique index if not exists connections_forward_address_idx on public.connections (((metadata ->> 'address'))) where provider = 'forward';
