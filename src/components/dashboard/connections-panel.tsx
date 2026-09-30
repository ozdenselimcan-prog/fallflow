"use client";

import { Globe, Loader2, Mail, MessageCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { apiFetch, useMutation } from "@/lib/use-api";
import { formatDateTime } from "@/lib/utils";
import { WidgetSnippet } from "./widget-snippet";

export interface ConnectionView {
  provider: "gmail" | "microsoft" | "whatsapp";
  status: "connected" | "error" | "disconnected";
  accountName: string;
  accountEmail: string;
  lastSyncedAt: string | null;
  lastError: string;
}

const META = {
  gmail: { title: "Gmail", text: "Neue Anfragen aus Ihrem Gmail-Postfach übernehmen und beantworten.", icon: Mail },
  microsoft: { title: "Microsoft 365 / Outlook", text: "Neue Anfragen aus Ihrem Outlook-Postfach übernehmen und beantworten.", icon: Mail },
  whatsapp: { title: "WhatsApp Business", text: "Nachrichten aus Ihrem WhatsApp-Business-Anschluss verarbeiten.", icon: MessageCircle },
} as const;

interface OAuthStatus {
  mode: "mock" | "live";
  missingConfig: string[];
  connected: boolean;
  message?: string;
}

function StatusBadge({ status }: { status: ConnectionView["status"] | "disconnected" }) {
  if (status === "connected") return <Badge tone="success">✓ Verbunden</Badge>;
  if (status === "error") return <Badge tone="danger">Fehler</Badge>;
  return <Badge>○ Nicht verbunden</Badge>;
}

/** Gmail/Microsoft: reiner OAuth-Connect-Button, führt zur Google-/Microsoft-Anmeldung. */
function OAuthCard({ provider, connection, canManage }: { provider: "gmail" | "microsoft"; connection: ConnectionView | null; canManage: boolean }) {
  const { title, text, icon: Icon } = META[provider];
  const { pending, run } = useMutation();
  const [testPending, setTestPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const connect = async () => {
    setNotice(null);
    const res = await run(() => apiFetch<OAuthStatus & { authUrl?: string }>("POST", `/api/integrations/${provider}`), { refresh: false });
    if (!res) return setNotice("Die Verbindung konnte nicht gestartet werden.");
    if (res.mode === "live" && res.authUrl) window.location.assign(res.authUrl);
    else setNotice(res.message ?? "Nicht konfiguriert.");
  };

  const disconnect = () => run(() => apiFetch("DELETE", `/api/integrations/${provider}`));

  const test = async () => {
    setTestPending(true);
    setNotice(null);
    try {
      await apiFetch("POST", `/api/integrations/${provider}/test`);
      setNotice("Verbindung funktioniert.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Test fehlgeschlagen.");
    } finally {
      setTestPending(false);
    }
  };

  const connected = connection?.status === "connected";

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Icon className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{text}</p>
            {connected && connection.accountEmail && <p className="mt-1 text-sm font-medium">{connection.accountEmail}</p>}
            {connected && connection.lastSyncedAt && <p className="text-xs text-muted-foreground">Zuletzt synchronisiert: {formatDateTime(connection.lastSyncedAt)}</p>}
            {connection?.status === "error" && connection.lastError && <p className="mt-1 text-xs text-danger">{connection.lastError}</p>}
          </div>
        </div>
        <StatusBadge status={connection?.status ?? "disconnected"} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {connected ? (
          <>
            <Button variant="secondary" size="sm" disabled={!canManage || testPending} onClick={test}>
              {testPending && <Loader2 className="size-3.5 animate-spin" />} Verbindung testen
            </Button>
            <Button variant="ghost" size="sm" disabled={!canManage || pending} onClick={disconnect}>
              <Trash2 className="size-3.5 text-danger" /> Trennen
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" disabled={!canManage} loading={pending} onClick={connect}>
            {title} verbinden
          </Button>
        )}
      </div>
      {notice && <Notice tone={notice.includes("funktioniert") ? "success" : "info"} className="mt-3">{notice}</Notice>}
    </Card>
  );
}

/** WhatsApp: kein OAuth (erfordert Meta-App-Prüfung/Embedded Signup) – Büro trägt seinen eigenen Zugriffstoken ein. */
function WhatsAppCard({ connection, canManage, appConfigured }: { connection: ConnectionView | null; canManage: boolean; appConfigured: boolean }) {
  const { title, text, icon: Icon } = META.whatsapp;
  const { pending, error, run } = useMutation();
  const [open, setOpen] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [testPending, setTestPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const connected = connection?.status === "connected";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(() => apiFetch("POST", "/api/integrations/whatsapp", { accessToken, phoneNumberId, wabaId }));
    if (ok) {
      setOpen(false);
      setAccessToken("");
    }
  };

  const disconnect = () => run(() => apiFetch("DELETE", "/api/integrations/whatsapp"));

  const test = async () => {
    setTestPending(true);
    setNotice(null);
    try {
      await apiFetch("POST", "/api/integrations/whatsapp/test");
      setNotice("Verbindung funktioniert.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Test fehlgeschlagen.");
    } finally {
      setTestPending(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Icon className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{text}</p>
            {connected && connection.accountEmail && <p className="mt-1 text-sm font-medium">{connection.accountEmail}</p>}
            {connected && connection.lastSyncedAt && <p className="text-xs text-muted-foreground">Zuletzt geprüft: {formatDateTime(connection.lastSyncedAt)}</p>}
            {connection?.status === "error" && connection.lastError && <p className="mt-1 text-xs text-danger">{connection.lastError}</p>}
          </div>
        </div>
        <StatusBadge status={connection?.status ?? "disconnected"} />
      </div>

      {!appConfigured && <Notice tone="info" className="mt-3">WhatsApp ist bei FallFlow noch nicht konfiguriert (App-Zugangsdaten fehlen).</Notice>}

      {appConfigured && (
        <div className="mt-4 space-y-3">
          {connected ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={!canManage || testPending} onClick={test}>
                {testPending && <Loader2 className="size-3.5 animate-spin" />} Verbindung testen
              </Button>
              <Button variant="ghost" size="sm" disabled={!canManage || pending} onClick={disconnect}>
                <Trash2 className="size-3.5 text-danger" /> Trennen
              </Button>
            </div>
          ) : open ? (
            <form onSubmit={submit} className="space-y-3">
              <Field label="Zugriffstoken" hint="Meta Business Suite → WhatsApp → API-Setup → Zugriffstoken">
                <Input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} required minLength={20} type="password" autoComplete="off" />
              </Field>
              <Field label="Telefonnummer-ID">
                <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} required pattern="\d{5,30}" />
              </Field>
              <Field label="WhatsApp-Business-Account-ID (optional)">
                <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} pattern="\d*" />
              </Field>
              {error && <Notice tone="error">{error}</Notice>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={pending}>
                  Verbinden
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Abbrechen
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="secondary" size="sm" disabled={!canManage} onClick={() => setOpen(true)}>
              WhatsApp verbinden
            </Button>
          )}
        </div>
      )}
      {notice && <Notice tone={notice.includes("funktioniert") ? "success" : "info"} className="mt-3">{notice}</Notice>}
    </Card>
  );
}

interface Props {
  appUrl: string;
  companyId: string;
  canManage: boolean;
  gmail: ConnectionView | null;
  microsoft: ConnectionView | null;
  whatsapp: ConnectionView | null;
  whatsappAppConfigured: boolean;
  websiteConnected: boolean;
  /** Im Onboarding gibt es die Website-Karte schon als eigenen Schritt – dort ausblenden. */
  showWebsite?: boolean;
}

export function ConnectionsPanel({ appUrl, companyId, canManage, gmail, microsoft, whatsapp, whatsappAppConfigured, websiteConnected, showWebsite = true }: Props) {
  return (
    <div className="space-y-4">
      {showWebsite && (
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Globe className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">Website-Chat</h2>
                <p className="text-sm text-muted-foreground">Ein Script-Tag genügt, um das Widget in Ihre bestehende Website einzubinden.</p>
              </div>
            </div>
            <StatusBadge status={websiteConnected ? "connected" : "disconnected"} />
          </div>
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">Fügen Sie diesen Code vor dem schließenden &lt;/body&gt;-Tag Ihrer Website ein:</p>
            <WidgetSnippet appUrl={appUrl} companyId={companyId} />
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <OAuthCard provider="gmail" connection={gmail} canManage={canManage} />
        <OAuthCard provider="microsoft" connection={microsoft} canManage={canManage} />
      </div>
      <WhatsAppCard connection={whatsapp} canManage={canManage} appConfigured={whatsappAppConfigured} />
    </div>
  );
}
