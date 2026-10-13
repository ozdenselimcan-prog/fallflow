-- Empfehlungsprogramm: Jedes Büro hat einen eigenen Empfehlungscode (Link fallflow.xyz/signup?ref=CODE).
-- Meldet sich ein Kollege darüber an, wird das festgehalten; sobald er zahlender Kunde wird, bekommt das
-- empfehlende Büro einen Monat gutgeschrieben (siehe src/lib/billing/referrals.ts).
-- Beide Tabellen sind für Büros nur lesbar – schreiben dürfen ausschließlich die Trigger bzw. der Server
-- (Service-Role), damit sich niemand selbst Empfehlungen oder Gutschriften eintragen kann.

create table if not exists public.referral_codes (
  company_id uuid primary key references public.companies(id) on delete cascade,
  code text not null unique default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  -- das geworbene Büro (jedes Büro kann nur einmal geworben werden)
  company_id uuid primary key references public.companies(id) on delete cascade,
  -- das empfehlende Büro
  referrer_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Zeitpunkt der Gutschrift für das empfehlende Büro (null = noch nicht zahlender Kunde)
  rewarded_at timestamptz,
  constraint referrals_not_self check (company_id <> referrer_id)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;

drop policy if exists referral_codes_select on public.referral_codes;
create policy referral_codes_select on public.referral_codes for select using (public.is_member(company_id));
drop policy if exists referrals_select on public.referrals;
create policy referrals_select on public.referrals for select using (public.is_member(referrer_id));

-- Code für alle bestehenden Büros
insert into public.referral_codes (company_id) select id from public.companies on conflict do nothing;

-- Code für jedes neue Büro
create or replace function public.create_referral_code()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.referral_codes (company_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists on_company_created_referral on public.companies;
create trigger on_company_created_referral
  after insert on public.companies
  for each row execute function public.create_referral_code();

-- Neue Anmeldung mit Empfehlungscode (?ref=…): das gerade angelegte Büro dem empfehlenden Büro zuordnen.
-- Läuft nach on_auth_user_created (Trigger feuern alphabetisch), das Büro existiert also schon.
create or replace function public.handle_referral_signup()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ref text;
  referrer uuid;
  cid uuid;
begin
  ref := lower(trim(coalesce(new.raw_user_meta_data ->> 'ref', '')));
  if ref = '' then return new; end if;
  select company_id into referrer from public.referral_codes where code = ref;
  select company_id into cid from public.company_members where user_id = new.id and role = 'OWNER' limit 1;
  if referrer is not null and cid is not null and referrer <> cid then
    insert into public.referrals (company_id, referrer_id) values (cid, referrer) on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_referral on auth.users;
create trigger on_auth_user_referral
  after insert on auth.users
  for each row execute function public.handle_referral_signup();

revoke all on function public.create_referral_code() from public, anon, authenticated;
revoke all on function public.handle_referral_signup() from public, anon, authenticated;
