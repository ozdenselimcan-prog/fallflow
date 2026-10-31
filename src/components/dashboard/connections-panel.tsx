"use client";

import { mailProvider, providerForEmail, type MailProvider } from "@/lib/integrations/mail-providers";
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
  provider: "gmail" | "microsoft";
  status: "connected" | "error" | "disconnected";
  accountName: string;
  accountEmail: string;
  lastSyncedAt: string | null;
  lastError: string;
  /** Weiterleitung (Outlook → Gmail): die Adresse, die die Kunden kennen. */
  replyTo?: string;
}

function StatusBadge({ status }: { status: ConnectionView["status"] | "disconnected" }) {
  if (status === "connected") return <Badge tone="success">✓ Verbunden</Badge>;
  if (status === "error") return <Badge tone="danger">Fehler</Badge>;
  return <Badge>○ Nicht verbunden</Badge>;
}

const OUTLOOK_PRESET = "Outlook / Microsoft 365 / Hotmail";
const GMAIL_SERVERS = { imapHost: "imap.gmail.com", imapPort: 993, smtpHost: "smtp.gmail.com", smtpPort: 465 };

const PRESETS: { label: string; imapHost: string; imapPort: number; smtpHost: string; smtpPort: number }[] = [
  { label: "Gmail / Google Workspace", ...GMAIL_SERVERS },
  // Microsoft lässt keine Anmeldung per Passwort mehr zu – deshalb Weiterleitung an ein Gmail-Hilfspostfach (siehe OutlookForwardingGuide).
  { label: OUTLOOK_PRESET, ...GMAIL_SERVERS },
  { label: "GMX", imapHost: "imap.gmx.net", imapPort: 993, smtpHost: "mail.gmx.net", smtpPort: 465 },
  { label: "Web.de", imapHost: "imap.web.de", imapPort: 993, smtpHost: "smtp.web.de", smtpPort: 465 },
  { label: "IONOS", imapHost: "imap.ionos.de", imapPort: 993, smtpHost: "smtp.ionos.de", smtpPort: 465 },
  { label: "Strato", imapHost: "imap.strato.de", imapPort: 993, smtpHost: "smtp.strato.de", smtpPort: 465 },
  { label: "T-Online", imapHost: "secureimap.t-online.de", imapPort: 993, smtpHost: "securesmtp.t-online.de", smtpPort: 465 },
];

const DEFAULT_FORM = { email: "", password: "", imapHost: "", imapPort: 993, smtpHost: "", smtpPort: 465, replyTo: "" };

const linkClass = "font-medium text-accent underline underline-offset-2";

/** Outlook/Microsoft 365: Die Kunden schreiben weiter an die gewohnte Adresse, Outlook leitet an ein Gmail-Postfach weiter, das FallFlow abruft. */
function OutlookForwardingGuide({ microsoftAvailable }: { microsoftAvailable: boolean }) {
  return (
    <div className="space-y-2 rounded-xl border border-accent/30 bg-accent/5 p-4 text-xs leading-relaxed text-muted-foreground">
      {microsoftAvailable && (
        <p className="rounded-lg bg-background p-2.5 text-sm text-foreground">
          Am einfachsten: oben <span className="font-medium">„Mit Microsoft anmelden“</span> klicken und mit Ihrer Outlook-Adresse und Ihrem Passwort anmelden. Die
          Weiterleitung unten brauchen Sie nur, falls das bei Ihnen nicht klappt (z. B. weil Ihre IT die Anmeldung nicht freigibt).
        </p>
      )}
      <p className="text-sm font-medium text-foreground">{microsoftAvailable ? "Alternative: Weiterleitung" : "So verbinden Sie Outlook"} – Ihre E-Mail-Adresse bleibt gleich</p>
      <p>
        Microsoft erlaubt anderen Programmen keine Anmeldung per Passwort mehr. Deshalb leitet Outlook Ihre Mails an ein Gmail-Postfach weiter, das nur
        FallFlow nutzt. Ihre Kunden merken davon nichts: Sie schreiben weiter an Ihre gewohnte Adresse, sehen Ihren Büronamen als Absender, und ihre
        Antworten gehen wieder an Ihre gewohnte Adresse.
      </p>
      <ol className="list-decimal space-y-1.5 pl-4">
        <li>
          <a href="https://accounts.google.com/signup" target="_blank" rel="noopener noreferrer" className={linkClass}>Kostenloses Gmail-Postfach anlegen ↗</a>{" "}
          (z. B. ihrbuero.anfragen@gmail.com), dort die{" "}
          <a href="https://myaccount.google.com/signinoptions/twosv" target="_blank" rel="noopener noreferrer" className={linkClass}>2-Schritt-Verifizierung ↗</a>{" "}
          einschalten und ein{" "}
          <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className={linkClass}>App-Passwort erstellen ↗</a>.
        </li>
        <li>Unten Ihre Outlook-Adresse, die neue Gmail-Adresse und das App-Passwort eintragen und auf „E-Mail verbinden“ klicken.</li>
        <li>
          In Outlook die Weiterleitung einschalten:{" "}
          <a href="https://outlook.office.com/mail/options/mail/forwarding" target="_blank" rel="noopener noreferrer" className={linkClass}>Microsoft 365 ↗</a> bzw.{" "}
          <a href="https://outlook.live.com/mail/0/options/mail/forwarding" target="_blank" rel="noopener noreferrer" className={linkClass}>Outlook.com/Hotmail ↗</a> → „Weiterleitung
          aktivieren“ → Gmail-Adresse eintragen → „Kopie der weitergeleiteten Nachrichten behalten“ anhaken → Speichern.
        </li>
        <li>Testen: Schreiben Sie von einer anderen Adresse (z. B. vom Handy) eine Mail an Ihre Outlook-Adresse – sie erscheint nach wenigen Minuten unter „Anfragen“.</li>
      </ol>
      <p>
        Kommt nichts an oder erhalten Sie eine Fehlermail („externe Weiterleitung nicht erlaubt“)? Bei Microsoft 365 muss die Weiterleitung einmal vom
        Administrator erlaubt werden:{" "}
        <a href="https://security.microsoft.com/antispam" target="_blank" rel="noopener noreferrer" className={linkClass}>Microsoft Defender → Antispamrichtlinien ↗</a> →
        „Antispamrichtlinie für ausgehende Nachrichten (Standard)“ → „Schutzeinstellungen bearbeiten“ → Regeln für automatische Weiterleitung: „Ein –
        Weiterleitung ist aktiviert“.
      </p>
    </div>
  );
}

const APP_PASSWORD_LINKS: { host: string; label: string; url: string }[] = [
  { host: "imap.gmail.com", label: "App-Passwort bei Google erstellen", url: "https://myaccount.google.com/apppasswords" },
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

/** Erkannter Anbieter: was der Kunde tun muss (z. B. IMAP erlauben, App-Passwort), mit Direktlink. */
function ProviderHelp({ provider, microsoftAvailable }: { provider: MailProvider; microsoftAvailable: boolean }) {
  return (
    <div className="space-y-2 rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm">
      <p className="font-medium">Erkannt: {provider.label}</p>
      {provider.microsoft && !microsoftAvailable ? (
        <p className="text-xs text-muted-foreground">Für Outlook unten unter „Server-Einstellungen“ den Anbieter „Outlook“ wählen – dann führt FallFlow Sie durch die Weiterleitung.</p>
      ) : (
        <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
          {provider.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      {provider.link && (
        <a href={provider.link.url} target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-medium text-accent underline underline-offset-2">
          {provider.link.label} ↗
        </a>
      )}
    </div>
  );
}

/** E-Mail per IMAP/SMTP verbinden – eigene Zugangsdaten des Büros, kein OAuth, keine "App nicht von
 * Google geprüft"-Warnung. Funktioniert mit Gmail (per App-Passwort) und praktisch jedem
 * Anbieter, der IMAP/SMTP anbietet. */
const MICROSOFT_NOTICES: Record<string, { tone: "success" | "error"; text: string }> = {
  "microsoft-connected": { tone: "success", text: "Ihr Microsoft-Postfach ist verbunden." },
  "microsoft-denied": { tone: "error", text: "Die Anmeldung bei Microsoft wurde abgebrochen." },
  "microsoft-error": { tone: "error", text: "Die Anmeldung bei Microsoft hat nicht geklappt. Bitte erneut versuchen – bei Firmenkonten muss ggf. Ihre IT FallFlow einmal freigeben." },
  "microsoft-failed": { tone: "error", text: "Die Verbindung zu Microsoft konnte nicht gespeichert werden. Bitte erneut versuchen." },
};

function EmailCard({ connection, canManage, microsoftAvailable, returnTo, integrationResult }: { connection: ConnectionView | null; canManage: boolean; microsoftAvailable: boolean; returnTo: string; integrationResult?: string }) {
  const { pending, run } = useMutation();
  const [testPending, setTestPending] = useState(false);
  // Rückmeldung nach der Microsoft-Anmeldung (?integration=microsoft-…) direkt anzeigen.
  const [notice, setNotice] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(() => MICROSOFT_NOTICES[integrationResult ?? ""] ?? null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const connected = connection?.status === "connected";
  const provider = connection?.provider ?? "gmail";
  const [msPending, setMsPending] = useState(false);

  const connectMicrosoft = async () => {
    setNotice(null);
    setMsPending(true);
    try {
      const res = await apiFetch<{ authUrl: string }>("POST", "/api/integrations/microsoft", { returnTo });
      window.location.href = res.authUrl;
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Anmeldung konnte nicht gestartet werden." });
      setMsPending(false);
    }
  };

  const [forwarding, setForwarding] = useState(false);
  const [detected, setDetected] = useState<MailProvider | null>(null);
  const [detectDone, setDetectDone] = useState(false);
  const [serversOpen, setServersOpen] = useState(false);

  // Anbieter an der Adresse erkennen und Server-Daten eintragen (eigene Domain: über den MX-Eintrag, serverseitig).
  const detect = async (email: string) => {
    if (!email.includes("@")) return;
    let provider = providerForEmail(email);
    if (!provider) {
      const r = await apiFetch<{ provider: string | null }>("GET", `/api/integrations/detect?email=${encodeURIComponent(email)}`).catch(() => ({ provider: null }));
      provider = r.provider ? mailProvider(r.provider) : null;
    }
    setDetected(provider);
    setDetectDone(true);
    if (provider && !provider.microsoft) setForm((f) => ({ ...f, imapHost: provider.imapHost, imapPort: provider.imapPort, smtpHost: provider.smtpHost, smtpPort: provider.smtpPort }));
    setServersOpen(!provider);
  };

  const applyPreset = (label: string) => {
    setForwarding(label === OUTLOOK_PRESET);
    if (label === OUTLOOK_PRESET) setDetected(null);
    if (label !== OUTLOOK_PRESET) setForm((f) => ({ ...f, replyTo: "" }));
    const preset = PRESETS.find((p) => p.label === label);
    if (preset) setForm((f) => ({ ...f, imapHost: preset.imapHost, imapPort: preset.imapPort, smtpHost: preset.smtpHost, smtpPort: preset.smtpPort }));
  };

  const connect = async () => {
    setNotice(null);
    // Fehlermeldung direkt aus der Antwort nehmen – `error` aus useMutation ist hier noch der alte Stand.
    let failure = "";
    const res = await run(() =>
      apiFetch("POST", "/api/integrations/gmail", { ...form, replyTo: forwarding ? form.replyTo : "" }).catch((e: unknown) => {
        failure = e instanceof Error ? e.message : "Verbindung fehlgeschlagen.";
        throw e;
      }),
    );
    if (res) {
      setForm(DEFAULT_FORM);
      setForwarding(false);
      setDetected(null);
      setDetectDone(false);
    } else setNotice({ tone: "error", text: failure || "Verbindung fehlgeschlagen." });
  };

  const disconnect = () => run(() => apiFetch("DELETE", `/api/integrations/${provider}`));

  const test = async () => {
    setTestPending(true);
    setNotice(null);
    try {
      await apiFetch("POST", `/api/integrations/${provider}/test`);
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
            <p className="text-sm text-muted-foreground">Neue Anfragen aus Ihrem Postfach übernehmen und beantworten.</p>
            {connected && connection.accountEmail && (
              <p className="mt-1 text-sm font-medium">
                {connection.replyTo ?? connection.accountEmail}
                {provider === "microsoft" && <span className="font-normal text-muted-foreground"> · über Microsoft angemeldet</span>}
                {connection.replyTo && <span className="font-normal text-muted-foreground"> · weitergeleitet an {connection.accountEmail}</span>}
              </p>
            )}
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
            {microsoftAvailable && (
              <div className="space-y-2 rounded-xl border border-border p-4">
                <p className="text-sm font-medium">Outlook / Microsoft 365</p>
                <p className="text-xs text-muted-foreground">Einfach mit Ihrer Outlook-Adresse und Ihrem Passwort direkt bei Microsoft anmelden – keine Server-Einstellungen nötig. Bei Firmenkonten (Microsoft 365) muss beim ersten Mal ggf. der Administrator Ihrer Firma zustimmen.</p>
                <Button size="sm" loading={msPending} onClick={connectMicrosoft}>
                  Mit Microsoft anmelden
                </Button>
              </div>
            )}
            {microsoftAvailable && <p className="text-sm font-medium">Andere Anbieter (Gmail, GMX, Web.de, IONOS, Strato, eigene Domain …)</p>}
            <p className="flex items-start gap-1.5 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              Ihre Zugangsdaten werden verschlüsselt (AES-256) gespeichert und ausschließlich automatisiert für den Mail-Abruf und -Versand genutzt. Niemand sieht Ihr Passwort im Klartext – auch wir als Betreiber nicht. Wir als Betreiber haben keinen manuellen Zugriff auf Ihr Postfach: Niemand bei uns liest Ihre E-Mails mit – der Abruf und Versand läuft ausschließlich automatisiert über das System.
            </p>
            {!forwarding && (
              <Field label="Ihre E-Mail-Adresse" hint="Die Adresse, an die Ihre Kunden schreiben. FallFlow erkennt Ihren Anbieter und trägt die Server-Daten selbst ein.">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  onBlur={() => void detect(form.email)}
                  placeholder="buero@ihre-domain.de"
                />
              </Field>
            )}
            {!forwarding && detected && <ProviderHelp provider={detected} microsoftAvailable={microsoftAvailable} />}
            {!forwarding && detectDone && !detected && form.email.includes("@") && (
              <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                Ihren Anbieter kennen wir nicht automatisch. Die Server-Daten (IMAP/SMTP) stehen in der Hilfe Ihres Anbieters oder in Ihrem bisherigen E-Mail-Programm – unten unter
                „Server-Einstellungen“ eintragen.
              </p>
            )}
            {forwarding && <OutlookForwardingGuide microsoftAvailable={microsoftAvailable} />}
            {forwarding && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Ihre Outlook-Adresse (die Ihre Kunden kennen)">
                    <Input type="email" value={form.replyTo} onChange={(e) => setForm({ ...form, replyTo: e.target.value })} placeholder="info@ihre-domain.de" />
                  </Field>
                </div>
                <Field label="Gmail-Adresse (nur für FallFlow)">
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ihrbuero.anfragen@gmail.com" />
                </Field>
              </div>
            )}
            {!(detected?.microsoft && !forwarding) && (
              <Field label={forwarding ? "App-Passwort von Google" : detected?.id === "gmail" || detected?.id === "yahoo" ? "App-Passwort" : detected?.id === "tonline" ? "E-Mail-Passwort" : "Passwort"}>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </Field>
            )}
            <details open={serversOpen} onToggle={(e) => setServersOpen((e.target as HTMLDetailsElement).open)} className="rounded-xl border border-border">
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">Server-Einstellungen{detected && !forwarding ? ` (für ${detected.label} schon eingetragen)` : ""}</summary>
              <div className="space-y-3 border-t border-border p-4">
                <Field label="Anbieter selbst wählen (füllt die Felder aus)">
                  <Select defaultValue="" onChange={(e) => applyPreset(e.target.value)}>
                    <option value="">Manuell eingeben…</option>
                    {PRESETS.map((p) => (
                      <option key={p.label} value={p.label}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className={forwarding ? "hidden" : "grid gap-3 sm:grid-cols-2"}>
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
              </div>
            </details>
            <Button
              variant="secondary"
              size="sm"
              loading={pending}
              disabled={!form.email || !form.password || !form.imapHost || !form.smtpHost || (forwarding && !form.replyTo)}
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
  /** Verbundenes Postfach (per IMAP/SMTP oder über Microsoft). */
  gmail: ConnectionView | null;
  /** Ist die Anmeldung über Microsoft bei FallFlow eingerichtet? */
  microsoftAvailable?: boolean;
  /** Wohin nach der Microsoft-Anmeldung zurückgeleitet wird. */
  returnTo?: string;
  /** Ergebnis der Microsoft-Anmeldung aus der Rückleitung (?integration=…). */
  integrationResult?: string;
  websiteConnected: boolean;
  /** Im Onboarding gibt es die Website-Karte schon als eigenen Schritt – dort ausblenden. */
  showWebsite?: boolean;
}

export function ConnectionsPanel({ appUrl, companyId, canManage, gmail, microsoftAvailable = false, returnTo = "/dashboard/settings/connections", integrationResult, websiteConnected, showWebsite = true }: Props) {
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
        <EmailCard connection={gmail} canManage={canManage} microsoftAvailable={microsoftAvailable} returnTo={returnTo} integrationResult={integrationResult} />
      </div>
    </div>
  );
}
