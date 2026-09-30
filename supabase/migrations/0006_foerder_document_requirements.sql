-- FallFlow: Pro Büro einstellbar, ob bei der Leistung "Fördermittelberatung" zusätzlich
-- Energieausweis/Grundriss als Pflichtdokument verlangt werden (Standard: nein).

alter table public.companies add column if not exists foerder_energy_certificate boolean not null default false;
alter table public.companies add column if not exists foerder_floorplan boolean not null default false;
