"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { apiFetch, useMutation } from "@/lib/use-api";

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

export function CompanyForm({ initial, canEdit }: { initial: { name: string; website: string; phone: string; address: string }; canEdit: boolean }) {
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useMutation();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV({ ...v, [k]: e.target.value });
    setSaved(false);
  };
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
    </FormCard>
  );
}
