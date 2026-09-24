-- FallFlow Demo-Daten: Büro "BA Engineering & Consulting" mit fünf Beispielfällen.
--
-- Voraussetzung: Sie haben sich in der App bereits registriert.
-- Tragen Sie unten Ihre E-Mail ein und führen Sie das Script im SQL-Editor aus.
-- Es wandelt das bei der Registrierung angelegte Büro in das Demo-Büro um.

do $$
declare
  owner_email constant text := 'ihre@email.de';   -- <== anpassen
  uid uuid;
  cid uuid;
  rec jsonb;
  new_case uuid;
  demo jsonb := '[
    {"status":"COMPLETE","age":0,"source":"widget","f":{"name":"Max Mustermann","email":"max.mustermann@example.com","phone":"+49 170 1234567","postalCode":"82166","buildingType":"Einfamilienhaus","yearBuilt":"1982","livingArea":"165","heating":"Gas","service":"iSFP","energySource":"Erdgas","description":"Hallo, ich möchte mein Haus sanieren und brauche einen iSFP."}},
    {"status":"NEEDS_INFO","age":1,"source":"widget","f":{"name":"Anna Schmidt","email":"anna.schmidt@example.com","postalCode":"80999","buildingType":"Einfamilienhaus","yearBuilt":"1974","service":"Energieberatung","description":"Wir überlegen, die Fassade zu dämmen."}},
    {"status":"COMPLETE","age":2,"source":"email","f":{"name":"Thomas Weber","email":"t.weber@example.com","phone":"+49 151 7654321","postalCode":"85221","buildingType":"Mehrfamilienhaus","yearBuilt":"1990","livingArea":"420","heating":"Öl","service":"Heizung","description":"Ölheizung ist in die Jahre gekommen."}},
    {"status":"APPOINTMENT","age":4,"source":"widget","f":{"name":"Julia Fischer","email":"julia.fischer@example.com","phone":"+49 160 5556677","postalCode":"81675","buildingType":"Einfamilienhaus","yearBuilt":"1968","livingArea":"132","heating":"Fernwärme","service":"Energieausweis","description":"Energieausweis für den Verkauf benötigt."}},
    {"status":"NEW","age":5,"source":"whatsapp","f":{"name":"Michael Bauer","phone":"+49 172 9988776","postalCode":"83022","service":"Fördermittelberatung","description":"Welche Förderung gibt es für eine Wärmepumpe?"}}
  ]';
begin
  select id into uid from auth.users where lower(email) = lower(owner_email);
  if uid is null then
    raise exception 'Kein Benutzer mit E-Mail % gefunden. Bitte zuerst in der App registrieren.', owner_email;
  end if;

  select company_id into cid from public.company_members where user_id = uid and status = 'active' order by created_at limit 1;

  update public.companies
     set name = 'BA Engineering & Consulting', website = 'https://example.com', phone = '+49 89 000000',
         address = 'Beispielstraße 1, 80331 München', onboarding_completed = true,
         services = array['Energieberatung','iSFP','Energieausweis','Fördermittelberatung']
   where id = cid;

  delete from public.cases where company_id = cid;

  for rec in select * from jsonb_array_elements(demo) loop
    insert into public.cases (company_id, status, completeness, customer_name, service, source, summary, created_at, updated_at)
    values (
      cid, rec ->> 'status',
      case rec ->> 'status' when 'NEEDS_INFO' then 70 when 'NEW' then 40 else 100 end,
      rec -> 'f' ->> 'name', rec -> 'f' ->> 'service', rec ->> 'source',
      'Anfrage von ' || (rec -> 'f' ->> 'name') || ': ' || coalesce(rec -> 'f' ->> 'description', ''),
      now() - ((rec ->> 'age')::int || ' days')::interval,
      now() - ((rec ->> 'age')::int || ' days')::interval
    ) returning id into new_case;

    insert into public.case_fields (case_id, company_id, key, value)
    select new_case, cid, k, v from jsonb_each_text(rec -> 'f');

    insert into public.case_events (case_id, company_id, type, text) values
      (new_case, cid, 'received', 'Anfrage eingegangen');
    insert into public.case_messages (case_id, company_id, role, content) values
      (new_case, cid, 'user', rec -> 'f' ->> 'description');

    if rec ->> 'status' = 'APPOINTMENT' then
      insert into public.appointments (company_id, case_id, title, starts_at, duration_min)
      values (cid, new_case, 'Erstgespräch ' || (rec -> 'f' ->> 'name'), date_trunc('day', now()) + interval '2 days 10 hours', 45);
    end if;
  end loop;
end;
$$;
