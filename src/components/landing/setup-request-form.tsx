"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { apiFetch } from "@/lib/use-api";

const EMPTY = { name: "", company: "", industry: "", phone: "", email: "", when: "", note: "", website: "" };

/** Formular auf /einrichtung: Rückruf für die persönliche Einrichtung anfragen (geht per Mail an den Support). */
export function SetupRequestForm() {
  const [form, setForm] = useState(EMPTY);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await apiFetch("POST", "/api/setup-request", form);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Senden fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  };

  if (sent)
    return (
      <div className="rounded-xl border border-success/40 bg-success-soft p-6 text-center">
        <CheckCircle2 className="mx-auto size-8 text-success" />
        <p className="mt-3 text-lg font-semibold">Danke! Wir melden uns in der Regel innerhalb eines Werktags.</p>
        <p className="mt-1 text-sm text-muted-foreground">Wir rufen Sie an und richten FallFlow in etwa 20 Minuten gemeinsam mit Ihnen ein.</p>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ihr Name">
          <Input value={form.name} onChange={set("name")} required maxLength={100} autoComplete="name" />
        </Field>
        <Field label="Name des Betriebs">
          <Input value={form.company} onChange={set("company")} required maxLength={120} autoComplete="organization" />
        </Field>
        <Field label="Telefon">
          <Input type="tel" value={form.phone} onChange={set("phone")} required maxLength={40} autoComplete="tel" />
        </Field>
        <Field label="E-Mail">
          <Input type="email" value={form.email} onChange={set("email")} required maxLength={200} autoComplete="email" />
        </Field>
        <Field label="Branche (optional)">
          <Input value={form.industry} onChange={set("industry")} maxLength={80} placeholder="z. B. Dachdecker" />
        </Field>
        <Field label="Wann sind Sie gut erreichbar? (optional)">
          <Input value={form.when} onChange={set("when")} maxLength={200} placeholder="z. B. werktags ab 17 Uhr" />
        </Field>
      </div>
      <Field label="Noch etwas, das wir wissen sollten? (optional)">
        <Textarea value={form.note} onChange={set("note")} maxLength={1000} rows={3} />
      </Field>
      {/* Für Spam-Bots: unsichtbar, Menschen lassen es leer. */}
      <input type="text" name="website" value={form.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <p className="text-xs text-muted-foreground">
        Wir nutzen Ihre Angaben nur, um Sie für die Einrichtung zu kontaktieren (siehe{" "}
        <a href="/datenschutz#kontakt" className="underline underline-offset-2">
          Datenschutz
        </a>
        ).
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" size="lg" loading={pending} className="w-full sm:w-auto">
        Rückruf anfordern
      </Button>
    </form>
  );
}
