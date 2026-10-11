-- FallFlow: Löschung der Daten 30 Tage nach Vertragsende (siehe AVV § 9).
-- canceled_at: wann das Abo endgültig beendet wurde; deletion_warning_sent_at: Hinweis 7 Tage vor der Löschung verschickt.

alter table public.subscriptions add column if not exists canceled_at timestamptz;
alter table public.subscriptions add column if not exists deletion_warning_sent_at timestamptz;

-- Bereits beendete Abos: Vertragsende = Ende des letzten Abrechnungszeitraums (sonst jetzt).
update public.subscriptions set canceled_at = coalesce(current_period_end, now()) where status = 'canceled' and canceled_at is null;
