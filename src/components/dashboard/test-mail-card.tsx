"use client";

import { AlertCircle, CalendarCheck, FileText, Mail, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { apiFetch, useMutation } from "@/lib/use-api";
import { cn } from "@/lib/utils";

interface Preview {
  handled: boolean;
  service?: string;
  status?: string;
  attention?: string;
  reply?: string;
  attachments?: { title: string; infoOnly: boolean }[];
  missing?: string[];
  appointmentProposed?: boolean;
}

const EXAMPLES: { label: string; subject: string; body: string }[] = [
  { label: "Neue Anfrage", subject: "Anfrage iSFP", body: "Guten Tag, wir möchten für unser Einfamilienhaus von 1975 einen individuellen Sanierungsfahrplan erstellen lassen. Viele Grüße, Erika Beispiel" },
  { label: "Kunde stellt eine Frage", subject: "Energieausweis", body: "Hallo, ich brauche einen Energieausweis für den Verkauf meiner Wohnung. Was kostet das bei Ihnen und wie lange dauert es?" },
  { label: "Leistung unklar", subject: "Anfrage", body: "Guten Tag, wir haben ein altes Haus gekauft und wissen nicht genau, was wir machen sollen." },
];

/**
 * "Testmail ausprobieren": Das Büro schreibt eine Beispiel-Anfrage wie ein Kunde und sieht sofort, was FallFlow
 * antworten würde (Text, angehängte PDFs, was danach noch fehlt). Es wird nichts versendet und kein Fall gespeichert.
 */
export function TestMailCard() {
  const [subject, setSubject] = useState(EXAMPLES[0].subject);
  const [body, setBody] = useState(EXAMPLES[0].body);
  const [preview, setPreview] = useState<Preview | null>(null);
  const { pending, error, run } = useMutation();

  const send = async () => {
    setPreview(null);
    const out = await run(() => apiFetch<Preview>("POST", "/api/simulate/email", { subject, body, fromName: "Testkunde", preview: true }), { refresh: false });
    if (out) setPreview(out);
  };

  return (
    <Card>
      <CardHeader
        title="Testmail ausprobieren"
        description="Schreiben Sie eine Anfrage wie ein Kunde und sehen Sie sofort, was FallFlow antworten würde. Es wird nichts versendet und kein Fall angelegt – speichern Sie Änderungen an Ihren Nachrichten vorher."
        action={<Mail className="size-4 text-accent" aria-hidden />}
      />
      <div className="space-y-4 px-5 pb-5">
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e.label}
              type="button"
              onClick={() => {
                setSubject(e.subject);
                setBody(e.body);
                setPreview(null);
              }}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:border-accent hover:text-accent"
            >
              Beispiel: {e.label}
            </button>
          ))}
        </div>
        <Field label="Betreff">
          <Input value={subject} maxLength={300} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Nachricht des Kunden">
          <Textarea rows={4} value={body} maxLength={8000} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Button onClick={send} loading={pending} disabled={!body.trim()}>
          <Send className="size-4" /> Testmail ausprobieren
        </Button>
        {error && <Notice tone="error">{error}</Notice>}

        {preview && !preview.handled && (
          <Notice>Diese Mail würde FallFlow nicht als Kundenanfrage erkennen (z. B. Werbung oder Rechnung) – sie bleibt nur in Ihrem Postfach, es entsteht kein Fall.</Notice>
        )}

        {preview?.handled && (
          <div className="space-y-3 rounded-xl border border-border bg-background p-4 text-sm">
            <p className="text-muted-foreground">
              Erkannte Leistung: <span className="font-medium text-foreground">{preview.service || "keine"}</span> · Status: <span className="font-medium text-foreground">{preview.status}</span>
            </p>
            {preview.attention ? (
              <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-warning">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  <span className="font-medium">Keine automatische Antwort: </span>
                  {preview.attention}. Die Mail erscheint im Posteingang unter „Aufmerksamkeit benötigt“ und Sie antworten selbst.
                </span>
              </p>
            ) : (
              <>
                <div>
                  <p className="mb-1 text-xs font-semibold tracking-wider text-muted-foreground">ANTWORT AN DEN KUNDEN</p>
                  <p className="whitespace-pre-line rounded-lg border border-border bg-card p-3">{preview.reply || "(keine Antwort)"}</p>
                </div>
                {!!preview.attachments?.length && (
                  <div className="flex flex-wrap gap-1.5">
                    {preview.attachments.map((a) => (
                      <span key={a.title} className={cn("inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs", a.infoOnly ? "text-muted-foreground" : "font-medium")}>
                        <FileText className="size-3" aria-hidden /> {a.title} {a.infoOnly ? "(nur zur Info)" : "(ausgefüllt zurück)"}
                      </span>
                    ))}
                  </div>
                )}
                {preview.appointmentProposed && (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarCheck className="size-4" aria-hidden /> Es würde direkt ein Termin vorgeschlagen (wartet auf Ihre Bestätigung).
                  </p>
                )}
                {!!preview.missing?.length && <p className="text-muted-foreground">Danach wartet FallFlow noch auf: {preview.missing.join(", ")}.</p>}
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
