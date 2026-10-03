-- "Website" galt bisher ab Signup faelschlich als "verbunden", obwohl das Widget-Skript noch gar nicht auf der
-- eigenen Seite eingebunden wurde. Jetzt wie die anderen Kanaele: erst "verbunden", sobald wirklich eine
-- Anfrage ueber das Widget eingegangen ist (siehe POST /api/widget/message).

create or replace function public.seed_company_defaults(cid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.assistant_settings (company_id) values (cid) on conflict do nothing;
  insert into public.subscriptions (company_id) values (cid) on conflict do nothing;

  insert into public.channels (company_id, kind, status) values
    (cid, 'website', 'disconnected'),
    (cid, 'gmail', 'disconnected'),
    (cid, 'microsoft', 'disconnected'),
    (cid, 'whatsapp', 'coming_soon')
  on conflict do nothing;

  insert into public.assistant_questions (company_id, key, label, prompt, type, options, required, active, position) values
    (cid, 'service', 'Anliegen', 'Welche Leistung möchten Sie anfragen?', 'choice',
      array['Energieberatung','iSFP','Energieausweis','Fördermittelberatung','Baubegleitung','Heizung','Sanierung','Sonstiges'], true, true, 0),
    (cid, 'buildingType', 'Gebäudeart', 'Welche Art Gebäude möchten Sie sanieren?', 'choice',
      array['Einfamilienhaus','Mehrfamilienhaus','Sonstiges'], true, true, 1),
    (cid, 'yearBuilt', 'Baujahr', 'Was ist das Baujahr des Gebäudes?', 'number', '{}', true, true, 2),
    (cid, 'livingArea', 'Wohnfläche', 'Wie groß ist die Wohnfläche in m²?', 'number', '{}', true, true, 3),
    (cid, 'heating', 'Heizung', 'Welche Heizung ist aktuell installiert?', 'choice',
      array['Gas','Öl','Wärmepumpe','Fernwärme','Holz/Pellets','Strom','Sonstiges'], false, true, 4),
    (cid, 'postalCode', 'PLZ', 'In welcher Postleitzahl liegt das Gebäude?', 'postal', '{}', true, true, 5),
    (cid, 'name', 'Name', 'Wie lautet Ihr vollständiger Name?', 'text', '{}', true, true, 6),
    (cid, 'email', 'E-Mail', 'Unter welcher E-Mail-Adresse können wir Sie erreichen?', 'email', '{}', true, true, 7),
    (cid, 'phone', 'Telefonnummer', 'Unter welcher Telefonnummer erreichen wir Sie am besten?', 'phone', '{}', false, true, 8)
  on conflict do nothing;
end;
$$;

-- Bestehende Buero-Datensaetze korrigieren: "verbunden" nur dort, wo tatsaechlich schon eine
-- Widget-Anfrage eingegangen ist.
update public.channels c
set status = 'connected'
where c.kind = 'website'
  and exists (select 1 from public.cases ca where ca.company_id = c.company_id and ca.source = 'widget');

update public.channels c
set status = 'disconnected'
where c.kind = 'website'
  and not exists (select 1 from public.cases ca where ca.company_id = c.company_id and ca.source = 'widget');
