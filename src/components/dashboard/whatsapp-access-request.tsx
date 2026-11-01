"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { apiFetch } from "@/lib/use-api";
import { cn } from "@/lib/utils";

export interface AccessRequestView {
  requestedAt: string;
  status: "open" | "approved";
}

const IN_APP: { id: "yes" | "no" | "unknown"; label: string }[] = [
  { id: "yes", label: "Ja" },
  { id: "no", label: "Nein" },
  { id: "unknown", label: "Weiß nicht" },
];

/**
 * Solange Meta die FallFlow-App noch nicht freigegeben hat: WhatsApp-Freischaltung anfragen (siehe lib/whatsapp-access.ts).
 * Der Betreiber trägt den Betrieb in der Meta-App als Tester ein und gibt ihn frei – danach erscheint „Mit Facebook verbinden“.
 */
export function WhatsAppAccessRequest({ request, onSent }: { request: AccessRequestView | null; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", facebook: "", phone: "", contact: "", inApp: "" as "" | "yes" | "no" | "unknown" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (request) {
    return (
      <Notice tone="info">
        Ihre Anfrage ist bei uns angekommen ({new Date(request.requestedAt).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}). Wir schalten WhatsApp für Sie frei
        und melden uns – meist innerhalb von 24 Stunden. Sie bekommen dann von Facebook eine Einladung „als Tester“; bitte annehmen, danach erscheint hier der Knopf
        „Mit Facebook verbinden“.
      </Notice>
    );
  }

  const send = async () => {
    if (!form.inApp) return setError("Bitte angeben, ob die Nummer gerade in der WhatsApp-Business-App läuft.");
    setPending(true);
    setError(null);
    try {
      await apiFetch("POST", "/api/integrations/whatsapp/request", form);
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Anfrage konnte nicht gesendet werden");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground">
        Die WhatsApp-Anbindung schalten wir gerade Betrieb für Betrieb frei. Fragen Sie sie hier an – wir richten alles ein und melden uns, meist innerhalb von 24 Stunden.
      </p>
      {!open ? (
        <Button onClick={() => setOpen(true)}>WhatsApp-Freischaltung anfragen</Button>
      ) : (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ihr Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Ihr Facebook-Profil" hint="Link zu Ihrem Profil oder Ihr Name auf Facebook – damit tragen wir Sie bei Meta ein.">
              <Input value={form.facebook} onChange={(e) => setForm({ ...form, facebook: e.target.value })} placeholder="https://facebook.com/…" />
            </Field>
            <Field label="WhatsApp-Nummer, die verbunden werden soll">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+49 170 …" inputMode="tel" />
            </Field>
            <Field label="E-Mail oder Telefon für Rückfragen">
              <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </Field>
          </div>
          <div>
            <p className="text-sm font-medium">Nutzen Sie diese Nummer gerade in der WhatsApp-Business-App auf dem Handy?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {IN_APP.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={form.inApp === o.id}
                  onClick={() => setForm({ ...form, inApp: o.id })}
                  className={cn(
                    "min-w-20 rounded-full border px-4 py-1.5 text-sm font-medium",
                    form.inApp === o.id ? "border-accent bg-accent text-white" : "border-border bg-background hover:border-accent/50",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {form.inApp === "yes" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Gut zu wissen: Eine Nummer, die FallFlow beantwortet, läuft über die offizielle WhatsApp-Schnittstelle. Ob Sie sie parallel in der App behalten können
                oder lieber eine zweite Nummer nutzen, besprechen wir mit Ihnen vor der Einrichtung.
              </p>
            )}
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <Button onClick={send} loading={pending}>
            Anfrage senden
          </Button>
        </div>
      )}
    </div>
  );
}
