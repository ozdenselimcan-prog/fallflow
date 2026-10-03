"use client";

import { Globe, Loader2, Mail, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";
import { apiFetch, useMutation } from "@/lib/use-api";
import { formatDateTime } from "@/lib/utils";
import { WidgetSnippet } from "./widget-snippet";

export interface ConnectionView {
  provider: "gmail" | "microsoft";
  status: "connected" | "error" | "disconnected";
  accountName: string;
  accountEmail: string;
  lastSyncedAt: string | null;
  lastError: string;
}

const META = {
  gmail: { title: "Gmail", text: "Neue Anfragen aus Ihrem Gmail-Postfach übernehmen und beantworten.", icon: Mail },
  microsoft: { title: "Microsoft 365 / Outlook", text: "Neue Anfragen aus Ihrem Outlook-Postfach übernehmen und beantworten.", icon: Mail },
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

interface Props {
  appUrl: string;
  companyId: string;
  canManage: boolean;
  gmail: ConnectionView | null;
  microsoft: ConnectionView | null;
  websiteConnected: boolean;
  /** Im Onboarding gibt es die Website-Karte schon als eigenen Schritt – dort ausblenden. */
  showWebsite?: boolean;
}

export function ConnectionsPanel({ appUrl, companyId, canManage, gmail, microsoft, websiteConnected, showWebsite = true }: Props) {
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
    </div>
  );
}
