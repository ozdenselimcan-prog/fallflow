"use client";

import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { apiFetch } from "@/lib/use-api";
import { WhatsAppShare } from "./whatsapp-share";
import { WhatsAppAccessRequest, type AccessRequestView } from "./whatsapp-access-request";
import { WhatsAppSignup } from "./whatsapp-signup";

interface Status {
  available: boolean;
  access?: "open" | "approved" | "requested" | "request";
  request?: AccessRequestView | null;
  embedded: { appId: string; configId: string } | null;
  connection: { status: string; number: string; name: string; lastError: string } | null;
}

/** WhatsApp Business verbinden: Die KI beantwortet WhatsApp-Nachrichten wie den Website-Chat und legt Fälle an. */
export function WhatsAppCard({ canEdit }: { canEdit: boolean }) {
  const [s, setS] = useState<Status | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    apiFetch<Status>("GET", "/api/integrations/whatsapp")
      .then(setS)
      .catch(() => setS({ available: false, embedded: null, connection: null }));
  useEffect(() => {
    load();
  }, []);

  const connect = async () => {
    setPending(true);
    setError(null);
    try {
      await apiFetch("POST", "/api/integrations/whatsapp", { phoneNumberId, accessToken });
      setAccessToken("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verbindung fehlgeschlagen");
    } finally {
      setPending(false);
    }
  };
  const disconnect = async () => {
    setPending(true);
    await apiFetch("DELETE", "/api/integrations/whatsapp").catch(() => {});
    await load();
    setPending(false);
  };

  const connected = s?.connection?.status === "connected";
  return (
    <Card className="mt-4">
      <CardHeader
        title="WhatsApp"
        description="Kunden schreiben Ihnen per WhatsApp – die KI antwortet mit Ihren Texten, fragt fehlende Angaben ab und legt den Fall an. Fotos und PDFs landen in der Fallakte."
        action={connected ? <Badge tone="success">Verbunden</Badge> : <Badge>Nicht verbunden</Badge>}
      />
      <div className="space-y-4 p-5 text-sm">
        {s?.connection?.lastError && <Notice tone="error">{s.connection.lastError}</Notice>}
        {connected && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2">
              <MessageCircle className="size-4 text-success" aria-hidden />
              <span className="font-medium">{s?.connection?.number}</span>
              {s?.connection?.name && <span className="text-muted-foreground">· {s.connection.name}</span>}
            </p>
            {canEdit && (
              <Button variant="ghost" onClick={disconnect} disabled={pending}>
                Trennen
              </Button>
            )}
          </div>
        )}
        <a href="/dashboard/assistant/whatsapp" className="inline-block font-medium text-accent hover:underline">
          Festlegen, was im WhatsApp-Chat gefragt wird →
        </a>
        {connected && s?.connection?.number && <WhatsAppShare number={s.connection.number} />}
        {s && !s.available && <p className="text-muted-foreground">WhatsApp ist für diese Installation noch nicht eingerichtet.</p>}
        {s?.available && !connected && canEdit && (s.access === "request" || s.access === "requested") && (
          <WhatsAppAccessRequest request={s.access === "requested" ? (s.request ?? null) : null} onSent={() => void load()} />
        )}
        {s?.available && !connected && canEdit && s.access === "approved" && (
          <Notice tone="success">
            WhatsApp ist für Sie freigeschaltet. Falls noch nicht geschehen: Einladung als Tester auf{" "}
            <a href="https://developers.facebook.com/requests/" target="_blank" rel="noopener noreferrer" className="font-medium underline">
              developers.facebook.com/requests
            </a>{" "}
            annehmen – dann unten verbinden.
          </Notice>
        )}
        {s?.available && !connected && canEdit && s.embedded && (s.access === "open" || s.access === "approved") && <WhatsAppSignup />}
        {s?.available && !connected && canEdit && (s.access === "open" || s.access === "approved") && (
          <details className="space-y-3" open={!s.embedded}>
            <summary className={s.embedded ? "cursor-pointer text-xs text-muted-foreground" : "hidden"}>Manuell verbinden (Telefonnummer-ID und Zugangstoken)</summary>
            <p className="text-muted-foreground">
              Die Angaben finden Sie im Meta-Entwicklerbereich Ihrer WhatsApp-Business-App unter „WhatsApp → API-Setup“.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Telefonnummer-ID">
                <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} inputMode="numeric" placeholder="z. B. 123456789012345" />
              </Field>
              <Field label="Zugangstoken">
                <Input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="EAAG…" autoComplete="off" />
              </Field>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            <Button onClick={connect} loading={pending} disabled={!phoneNumberId.trim() || !accessToken.trim()}>
              WhatsApp verbinden
            </Button>
          </details>
        )}
      </div>
    </Card>
  );
}
