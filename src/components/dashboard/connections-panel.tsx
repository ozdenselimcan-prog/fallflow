"use client";

import { Globe, Loader2, Lock, Mail, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { apiFetch, useMutation } from "@/lib/use-api";
import { formatDateTime } from "@/lib/utils";
import { WidgetSnippet } from "./widget-snippet";

export interface ConnectionView {
  provider: "gmail";
  status: "connected" | "error" | "disconnected";
  accountName: string;
  accountEmail: string;
  lastSyncedAt: string | null;
  lastError: string;
}

function StatusBadge({ status }: { status: ConnectionView["status"] | "disconnected" }) {
  if (status === "connected") return <Badge tone="success">✓ Verbunden</Badge>;
  if (status === "error") return <Badge tone="danger">Fehler</Badge>;
  return <Badge>○ Nicht verbunden</Badge>;
}

const PRESETS: { label: string; imapHost: string; imapPort: number; smtpHost: string; smtpPort: number }[] = [
  { label: "Gmail / Google Workspace", imapHost: "imap.gmail.com", imapPort: 993, smtpHost: "smtp.gmail.com", smtpPort: 465 },
  { label: "Outlook / Microsoft 365", imapHost: "outlook.office365.com", imapPort: 993, smtpHost: "smtp.office365.com", smtpPort: 587 },
  { label: "GMX", imapHost: "imap.gmx.net", imapPort: 993, smtpHost: "mail.gmx.net", smtpPort: 465 },
  { label: "Web.de", imapHost: "imap.web.de", imapPort: 993, smtpHost: "smtp.web.de", smtpPort: 465 },
  { label: "IONOS", imapHost: "imap.ionos.de", imapPort: 993, smtpHost: "smtp.ionos.de", smtpPort: 465 },
  { label: "Strato", imapHost: "imap.strato.de", imapPort: 993, smtpHost: "smtp.strato.de", smtpPort: 465 },
  { label: "T-Online", imapHost: "secureimap.t-online.de", imapPort: 993, smtpHost: "securesmtp.t-online.de", smtpPort: 465 },
];

const DEFAULT_FORM = { email: "", password: "", imapHost: "", imapPort: 993, smtpHost: "", smtpPort: 465 };

const APP_PASSWORD_LINKS: { host: string; label: string; url: string }[] = [
  { host: "imap.gmail.com", label: "App-Passwort bei Google erstellen", url: "https://myaccount.google.com/apppasswords" },
  { host: "outlook.office365.com", label: "App-Kennwort bei Microsoft erstellen", url: "https://account.live.com/proofs/AppPassword" },
];

function AppPasswordLink({ imapHost }: { imapHost: string }) {
  const link = APP_PASSWORD_LINKS.find((l) => l.host === imapHost);
  if (!link) return null;
  return (
    <div className="space-y-1">
      <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-accent underline underline-offset-2">
        {link.label} ↗
      </a>
      {imapHost === "imap.gmail.com" && (
        <p className="text-xs text-muted-foreground">
          Meldet Google „Sie können aktuell keine App-Passwörter erstellen&quot;? Dann ist für dieses Google-Konto noch keine 2-Faktor-Authentifizierung (2-Schritt-Verifizierung) aktiviert – das muss zuerst eingerichtet werden, erst danach zeigt Google die Option für App-Passwörter an.
        </p>
      )}
    </div>
  );
}

/** E-Mail per IMAP/SMTP verbinden – eigene Zugangsdaten des Büros, kein OAuth, keine "App nicht von
 * Google geprüft"-Warnung. Funktioniert mit Gmail (per App-Passwort), Outlook und praktisch jedem
 * Anbieter, der IMAP/SMTP anbietet. */
function EmailCard({ connection, canManage }: { connection: ConnectionView | null; canManage: boolean }) {
  const { pending, error, run } = useMutation();
  const [testPending, setTestPending] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const connected = connection?.status === "connected";

  const applyPreset = (label: string) => {
    const preset = PRESETS.find((p) => p.label === label);
    if (preset) setForm((f) => ({ ...f, imapHost: preset.imapHost, imapPort: preset.imapPort, smtpHost: preset.smtpHost, smtpPort: preset.smtpPort }));
  };

  const connect = async () => {
    setNotice(null);
    const res = await run(() => apiFetch("POST", "/api/integrations/gmail", form));
    if (res) setForm(DEFAULT_FORM);
    else setNotice({ tone: "error", text: error ?? "Verbindung fehlgeschlagen." });
  };

  const disconnect = () => run(() => apiFetch("DELETE", "/api/integrations/gmail"));

  const test = async () => {
    setTestPending(true);
    setNotice(null);
    try {
      await apiFetch("POST", "/api/integrations/gmail/test");
      setNotice({ tone: "success", text: "Verbindung funktioniert." });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Test fehlgeschlagen." });
    } finally {
      setTestPending(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Mail className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">E-Mail</h2>
            <p className="text-sm text-muted-foreground">Neue Anfragen aus Ihrem Postfach übernehmen und beantworten – per IMAP/SMTP, ohne Google-/Microsoft-Freigabe.</p>
            {connected && connection.accountEmail && <p className="mt-1 text-sm font-medium">{connection.accountEmail}</p>}
            {connected && connection.lastSyncedAt && <p className="text-xs text-muted-foreground">Zuletzt synchronisiert: {formatDateTime(connection.lastSyncedAt)}</p>}
            {connection?.status === "error" && connection.lastError && <p className="mt-1 text-xs text-danger">{connection.lastError}</p>}
          </div>
        </div>
        <StatusBadge status={connection?.status ?? "disconnected"} />
      </div>

      {connected ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={!canManage || testPending} onClick={test}>
            {testPending && <Loader2 className="size-3.5 animate-spin" />} Verbindung testen
          </Button>
          <Button variant="ghost" size="sm" disabled={!canManage || pending} onClick={disconnect}>
            <Trash2 className="size-3.5 text-danger" /> Trennen
          </Button>
        </div>
      ) : (
        canManage && (
          <div className="mt-4 space-y-3">
            <p className="flex items-start gap-1.5 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              Ihre Zugangsdaten werden verschlüsselt (AES-256) gespeichert und ausschließlich automatisiert für den Mail-Abruf und -Versand genutzt. Niemand sieht Ihr Passwort im Klartext – auch wir als Betreiber nicht. Wir als Betreiber haben keinen manuellen Zugriff auf Ihr Postfach: Niemand bei uns liest Ihre E-Mails mit – der Abruf und Versand läuft ausschließlich automatisiert über das System.
            </p>
            <Field label="Üblicher Anbieter (füllt Server-Felder automatisch aus)">
              <Select defaultValue="" onChange={(e) => applyPreset(e.target.value)}>
                <option value="">Manuell eingeben…</option>
                {PRESETS.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="E-Mail-Adresse">
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="buero@ihre-domain.de" />
              </Field>
              <Field label="Passwort" hint="Bei Gmail/Outlook: ein App-Passwort nutzen, nicht das normale Konto-Passwort (braucht 2-Faktor-Auth).">
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <div className="mt-1">
                  <AppPasswordLink imapHost={form.imapHost} />
                </div>
              </Field>
              <Field label="IMAP-Server (Posteingang)">
                <Input value={form.imapHost} onChange={(e) => setForm({ ...form, imapHost: e.target.value })} placeholder="imap.ihre-domain.de" />
              </Field>
              <Field label="IMAP-Port">
                <Input type="number" value={form.imapPort} onChange={(e) => setForm({ ...form, imapPort: Number(e.target.value) })} />
              </Field>
              <Field label="SMTP-Server (Postausgang)">
                <Input value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} placeholder="smtp.ihre-domain.de" />
              </Field>
              <Field label="SMTP-Port">
                <Input type="number" value={form.smtpPort} onChange={(e) => setForm({ ...form, smtpPort: Number(e.target.value) })} />
              </Field>
            </div>
            <Button
              variant="secondary"
              size="sm"
              loading={pending}
              disabled={!form.email || !form.password || !form.imapHost || !form.smtpHost}
              onClick={connect}
            >
              E-Mail verbinden
            </Button>
          </div>
        )
      )}
      {notice && (
        <div className="mt-3 space-y-1.5">
          <Notice tone={notice.tone}>{notice.text}</Notice>
          {notice.tone === "error" && (
            <div>
              <AppPasswordLink imapHost={form.imapHost} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

interface Props {
  appUrl: string;
  companyId: string;
  canManage: boolean;
  gmail: ConnectionView | null;
  websiteConnected: boolean;
  /** Im Onboarding gibt es die Website-Karte schon als eigenen Schritt – dort ausblenden. */
  showWebsite?: boolean;
}

export function ConnectionsPanel({ appUrl, companyId, canManage, gmail, websiteConnected, showWebsite = true }: Props) {
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

      <div className="max-w-xl">
        <EmailCard connection={gmail} canManage={canManage} />
      </div>
    </div>
  );
}
