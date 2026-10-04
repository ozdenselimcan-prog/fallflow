-- Haelt fest, ob ein Abo zum Ende der aktuellen Periode gekuendigt wurde (Stripe "cancel_at_period_end"),
-- damit die Abrechnungsseite das dauerhaft anzeigen kann statt nur direkt nach dem Klick.
alter table public.subscriptions add column cancel_at_period_end boolean not null default false;
