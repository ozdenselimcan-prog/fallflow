"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { SERVICES } from "@/lib/cases/fields";
import { apiFetch, useMutation } from "@/lib/use-api";

const FOERDER_SERVICE = "Fördermittelberatung";

function FormCard({ children, onSubmit, pending, error, saved, canEdit = true }: { children: ReactNode; onSubmit: () => void; pending: boolean; error: string | null; saved: boolean; canEdit?: boolean }) {
  return (
    <Card className="p-5">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <fieldset disabled={!canEdit || pending} className="space-y-4">
          {children}
        </fieldset>
        {error && <Notice tone="error">{error}</Notice>}
        {saved && <Notice tone="success">Gespeichert.</Notice>}
        {canEdit ? <Button type="submit" loading={pending}>Speichern</Button> : <Notice>Nur Inhaber und Admins können diese Angaben ändern.</Notice>}
      </form>
    </Card>
  );
}

export function ProfileForm({ firstName, lastName, email }: { firstName: string; lastName: string; email: string }) {
  const [v, setV] = useState({ firstName, lastName });
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useMutation();
  return (
    <FormCard pending={pending} error={error} saved={saved} onSubmit={async () => setSaved(Boolean(await run(() => apiFetch("PUT", "/api/profile", v))))}>
      <Field label="Vorname">
        <Input value={v.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} required maxLength={60} />
      </Field>
      <Field label="Nachname">
        <Input value={v.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} required maxLength={60} />
      </Field>
      <Field label="E-Mail" hint="Die Anmelde-E-Mail kann hier nicht geändert werden.">
        <Input value={email} disabled readOnly />
      </Field>
    </FormCard>
  );
}

interface CompanyInitial {
  name: string;
  website: string;
  phone: string;
  address: string;
  services: string[];
  foerderEnergyCertificate: boolean;
  foerderFloorplan: boolean;
}

export function CompanyForm({ initial, canEdit }: { initial: CompanyInitial; canEdit: boolean }) {
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useMutation();
  const set = (k: "name" | "website" | "phone" | "address") => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV({ ...v, [k]: e.target.value });
    setSaved(false);
  };
  const toggleService = (service: string, on: boolean) => {
    setV({ ...v, services: on ? [...v.services, service] : v.services.filter((s) => s !== service) });
    setSaved(false);
  };
  const offersFoerderung = v.services.includes(FOERDER_SERVICE);

  return (
    <FormCard pending={pending} error={error} saved={saved} canEdit={canEdit} onSubmit={async () => setSaved(Boolean(await run(() => apiFetch("PUT", "/api/company", v))))}>
      <Field label="Firmenname">
        <Input value={v.name} onChange={set("name")} required maxLength={120} />
      </Field>
      <Field label="Website">
        <Input type="url" value={v.website} onChange={set("website")} placeholder="https://" maxLength={200} />
      </Field>
      <Field label="Telefon">
        <Input type="tel" value={v.phone} onChange={set("phone")} maxLength={40} />
      </Field>
      <Field label="Adresse">
        <Input value={v.address} onChange={set("address")} maxLength={300} />
      </Field>
      <Field label="Leistungen" hint="Nur ausgewählte Leistungen kann der Assistent Kunden anbieten.">
        <div className="grid gap-2 sm:grid-cols-2">
          {SERVICES.map((s) => (
            <Checkbox key={s} label={s} checked={v.services.includes(s)} onChange={(on) => toggleService(s, on)} />
          ))}
        </div>
      </Field>
      {offersFoerderung && (
        <Field label="Bei Fördermittelberatung zusätzlich verlangen" hint="Standardmäßig verlangt der Assistent bei reiner Fördermittelberatung weder Energieausweis noch Grundriss.">
          <div className="grid gap-2 sm:grid-cols-2">
            <Checkbox
              label="Energieausweis"
              checked={v.foerderEnergyCertificate}
              onChange={(on) => {
                setV({ ...v, foerderEnergyCertificate: on });
                setSaved(false);
              }}
            />
            <Checkbox
              label="Grundriss"
              checked={v.foerderFloorplan}
              onChange={(on) => {
                setV({ ...v, foerderFloorplan: on });
                setSaved(false);
              }}
            />
          </div>
        </Field>
      )}
    </FormCard>
  );
}
