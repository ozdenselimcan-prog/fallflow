-- Kostenlose Testphase nur einmal je E-Mail-Adresse: Bei jeder Registrierung mit Testphase wird ein Prüfwert (SHA-256)
-- der normalisierten E-Mail-Adresse gespeichert. Der Eintrag bleibt auch nach Löschung des Kontos erhalten, damit nach
-- einer Neuregistrierung nicht erneut getestet werden kann; nach drei Jahren wird er gelöscht (siehe trial-usage.ts).
-- Nur der Server (Service-Role) liest und schreibt – keine Policies für Büros.

create table if not exists public.trial_usage (
  email_hash text primary key,
  created_at timestamptz not null default now()
);

alter table public.trial_usage enable row level security;
