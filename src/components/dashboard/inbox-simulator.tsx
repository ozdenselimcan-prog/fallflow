"use client";

import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { apiFetch, useMutation } from "@/lib/use-api";

interface SimResult {
  caseId: string;
  matchedExisting: boolean;
  replies: string[];
}

const EXAMPLES = {
  whatsapp: { sender: "+49 172 9988776", text: "Hallo, das Haus ist von 1975 und wird mit Gas geheizt. Ich bin Eigentümer." },
  email: { sender: "lena.hoffmann@example.com", text: "Guten Tag, unser Einfamilienhaus hat ca. 140 m² und wurde 1992 gebaut." },
} as const;

/**
 * Simulator für eingehende Nachrichten. Läuft durch die echte Verarbeitung (Kunde erkennen → Fall zuordnen → KI reagiert),
 * ist aber klar als Simulation gekennzeichnet – es wird nichts über WhatsApp oder E-Mail gesendet oder empfangen.
 */
export function InboxSimulator() {
  const { pending, error, run } = useMutation();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [sender, setSender] = useState<string>(EXAMPLES.whatsapp.sender);
  const [text, setText] = useState<string>(EXAMPLES.whatsapp.text);
  const [result, setResult] = useState<SimResult | null>(null);

  const pick = (c: "whatsapp" | "email") => {
    setChannel(c);
    setSender(EXAMPLES[c].sender);
    setText(EXAMPLES[c].text);
    setResult(null);
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <FlaskConical className="size-4" /> Eingang simulieren
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Eingehende Nachricht simulieren">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await run(() => apiFetch<SimResult>("POST", "/api/inbox/simulate", { channel, sender, text }));
            if (res) setResult(res);
          }}
        >
          <Notice tone="info">
            <strong>Simulation.</strong> Die Nachricht durchläuft die echte Verarbeitung, es wird aber nichts über WhatsApp oder E-Mail gesendet oder empfangen. Kanäle ohne Zugangsdaten bleiben „nicht verbunden“.
          </Notice>
          <Field label="Kanal">
            <Select value={channel} onChange={(e) => pick(e.target.value as "whatsapp" | "email")}>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">E-Mail</option>
            </Select>
          </Field>
          <Field label={channel === "whatsapp" ? "Absender (Telefonnummer)" : "Absender (E-Mail-Adresse)"} hint="Passt der Absender zu einem bestehenden Fall, wird die Nachricht diesem Fall zugeordnet.">
            <Input value={sender} onChange={(e) => setSender(e.target.value)} required maxLength={120} />
          </Field>
          <Field label="Nachricht">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} required maxLength={1500} />
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          {result && (
            <Notice tone="success">
              {result.matchedExisting ? "Kunde erkannt – Nachricht wurde dem bestehenden Fall zugeordnet." : "Neuer Kunde – es wurde ein neuer Fall angelegt."}{" "}
              <Link href={`/dashboard/cases/${result.caseId}`} className="font-medium underline">
                Fallakte öffnen
              </Link>
              {result.replies.length > 0 && (
                <span className="mt-2 block text-foreground/80">
                  KI-Antwort (nicht versendet): „{result.replies[result.replies.length - 1]}“
                </span>
              )}
            </Notice>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Schließen
            </Button>
            <Button type="submit" loading={pending}>
              Nachricht simulieren
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
