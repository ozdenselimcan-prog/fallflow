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

type App = "business" | "personal" | "none";
const APPS: { id: App; label: string }[] = [
  { id: "business", label: "WhatsApp Business" },
  { id: "personal", label: "Normales WhatsApp" },
  { id: "none", label: "Noch gar nicht" },
];

/**
 * Solange Meta die FallFlow-App noch nicht freigegeben hat: WhatsApp-Freischaltung anfragen (siehe lib/whatsapp-access.ts).
 * Der Betreiber trägt den Betrieb in der Meta-App als Tester ein und gibt ihn frei – danach erscheint „Mit Facebook verbinden“.
 */
export function WhatsAppAccessRequest({ request, onSent }: { request: AccessRequestView | null; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", facebook: "", phone: "", contact: "", app: "" as "" | App });
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
    if (!form.app) return setError("Bitte angeben, welches WhatsApp Sie für diese Nummer nutzen.");
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
            <p className="text-sm font-medium">Welches WhatsApp nutzen Sie für diese Nummer?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {APPS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={form.app === o.id}
                  onClick={() => setForm({ ...form, app: o.id })}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm font-medium",
                    form.app === o.id ? "border-accent bg-accent text-white" : "border-border bg-background hover:border-accent/50",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {form.app === "business" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Sehr gut – Sie behalten Ihre Nummer und können die WhatsApp-Business-App weiter nutzen. Ihre bisherigen Kontakte beantworten Sie weiter selbst, neue
                Anfragen übernimmt FallFlow.
              </p>
            )}
            {form.app === "personal" && (
              <div className="mt-2 space-y-1.5 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                <p className="font-medium text-foreground">FallFlow braucht WhatsApp Business – der Umstieg dauert 5 Minuten, Ihre Nummer bleibt gleich:</p>
                <ol className="list-decimal space-y-1 pl-4">
                  <li>Im normalen WhatsApp ein Backup machen: Einstellungen → Chats → Chat-Backup.</li>
                  <li>Die kostenlose App „WhatsApp Business“ aus dem App Store bzw. Play Store auf demselben Handy installieren.</li>
                  <li>Beim Öffnen Ihre Nummer übernehmen und die Chats übertragen lassen – danach schreiben Sie über WhatsApp Business (wie gewohnt, nur mit Firmenprofil).</li>
                </ol>
                <p>
                  Gut zu wissen: Nutzen Sie die Nummer auch privat, sehen Freunde und Familie danach Ihr Firmenprofil. FallFlow antwortet ihnen nicht – das bleibt Ihre Sache.
                  Wer das trennen möchte, nimmt für den Betrieb eine zweite Nummer.
                </p>
              </div>
            )}
            {form.app === "none" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Dann installieren Sie einfach die kostenlose App „WhatsApp Business“ und richten die Nummer dort ein – z. B. Ihre Festnetznummer (Bestätigung per Anruf) oder
                eine zweite Handynummer.
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
