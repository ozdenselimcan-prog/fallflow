"use client";

import { Check, Copy, Forward, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { apiFetch, useMutation } from "@/lib/use-api";
import { formatDateTime } from "@/lib/utils";

interface ForwardingInfo {
  address: string;
  ownAddress: string;
  active: boolean;
  lastReceivedAt: string | null;
  gmailCode: { code: string; link: string; at: string } | null;
  recent: { from: string; subject: string; at: string; handled: boolean }[];
  sendingAvailable: boolean;
}

const linkClass = "font-medium text-accent underline underline-offset-2";

/** Klick-Anleitung je Anbieter: wo die Weiterleitung eingeschaltet wird. Immer mit „Kopie behalten“, damit nichts fehlt. */
const GUIDES: { id: string; label: string; steps: string[]; link?: { url: string; label: string } }[] = [
  {
    id: "gmail",
    label: "Gmail",
    link: { url: "https://mail.google.com/mail/u/0/#settings/fwdandpop", label: "Gmail-Weiterleitung öffnen" },
    steps: [
      "„Weiterleitungsadresse hinzufügen“ klicken und die FallFlow-Adresse einfügen.",
      "Google schickt einen Bestätigungscode an FallFlow – er erscheint gleich hier oben. Code in Gmail eintragen und bestätigen.",
      "„Eine Kopie eingehender Nachrichten weiterleiten an …“ wählen, daneben „Kopie im Posteingang behalten“ – unten speichern.",
    ],
  },
  {
    id: "outlook",
    label: "Outlook / Microsoft 365",
    link: { url: "https://outlook.office.com/mail/options/mail/forwarding", label: "Outlook-Weiterleitung öffnen" },
    steps: [
      "„Weiterleitung aktivieren“ einschalten und die FallFlow-Adresse einfügen.",
      "„Kopie weitergeleiteter Nachrichten beibehalten“ anhaken und speichern.",
      "Privates Outlook.com/Hotmail: gleiche Einstellung unter outlook.live.com. Bei Firmenkonten muss die IT externe Weiterleitung evtl. einmal erlauben.",
    ],
  },
  {
    id: "other",
    label: "IONOS, Strato, GMX, Web.de, T-Online …",
    steps: [
      "Im Webmail Ihres Anbieters die Einstellungen öffnen und „Weiterleitung“ suchen.",
      "Eine Weiterleitung an die FallFlow-Adresse anlegen – wichtig: „Kopie behalten“ bzw. „Original nicht löschen“ wählen.",
      "Speichern. Unsicher? Die Hilfe Ihres Anbieters zum Stichwort „Weiterleitung einrichten“ zeigt die genauen Klicks.",
    ],
  },
];

/**
 * Weiterleitung an die eigene FallFlow-Adresse (siehe lib/integrations/forwarding.ts) – der einfachste Weg: kein Passwort,
 * keine Server-Einstellungen. Lädt den Stand selbst und aktualisiert sich, solange auf die erste Mail gewartet wird.
 */
export function ForwardingCard({ canManage }: { canManage: boolean }) {
  const [info, setInfo] = useState<ForwardingInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [ownAddress, setOwnAddress] = useState("");
  const [guide, setGuide] = useState("gmail");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const { pending, run } = useMutation();

  const load = useCallback(
    () =>
      apiFetch<ForwardingInfo>("GET", "/api/integrations/forward")
        .then((data) => {
          setInfo(data);
          setOwnAddress((prev) => prev || data.ownAddress);
        })
        .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : "Weiterleitung konnte nicht geladen werden.")),
    [],
  );

  useEffect(() => {
    apiFetch<ForwardingInfo>("GET", "/api/integrations/forward")
      .then((data) => {
        setInfo(data);
        setOwnAddress((prev) => prev || data.ownAddress);
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : "Weiterleitung konnte nicht geladen werden."));
  }, []);

  // Bis die erste Mail angekommen ist (und solange ein Gmail-Code erwartet wird), alle 10 Sekunden nachsehen.
  const waiting = Boolean(info && !info.lastReceivedAt);
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, [waiting, load]);

  const copy = async () => {
    if (!info) return;
    await navigator.clipboard.writeText(info.address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activate = async () => {
    setNotice(null);
    let failure = "";
    const ok = await run(() =>
      apiFetch("POST", "/api/integrations/forward", { ownAddress }).catch((e: unknown) => {
        failure = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
        throw e;
      }),
    );
    if (ok) {
      setNotice({ tone: "success", text: "Gespeichert – FallFlow beantwortet ab jetzt weitergeleitete Anfragen." });
      await load();
    } else setNotice({ tone: "error", text: failure || "Speichern fehlgeschlagen." });
  };

  const deactivate = async () => {
    await run(() => apiFetch("DELETE", "/api/integrations/forward"));
    await load();
  };

  if (loadError) return <Notice tone="error">{loadError}</Notice>;
  if (!info)
    return (
      <Card className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Weiterleitung wird geladen …
      </Card>
    );

  const current = GUIDES.find((g) => g.id === guide) ?? GUIDES[0];
  const showCode = info.gmailCode && (!info.lastReceivedAt || Date.parse(info.gmailCode.at) >= Date.parse(info.lastReceivedAt) - 60_000);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Forward className="size-5" />
          </span>
          <div>
            <h2 className="flex flex-wrap items-center gap-2 font-semibold">
              E-Mail per Weiterleitung <Badge tone="accent">Empfohlen</Badge>
            </h2>
            <p className="text-sm text-muted-foreground">Kein Passwort, keine Server-Einstellungen: Ihr Postfach schickt eine Kopie neuer Mails an FallFlow.</p>
          </div>
        </div>
        {info.active ? <Badge tone="success">✓ Eingeschaltet</Badge> : <Badge>○ Aus</Badge>}
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <p className="text-sm font-medium">1. Ihre FallFlow-Adresse</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold break-all">{info.address}</code>
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Kopiert" : "Kopieren"}
            </Button>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium">2. In Ihrem Postfach die Weiterleitung an diese Adresse einschalten</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {GUIDES.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGuide(g.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${g.id === guide ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted"}`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
            {current.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {current.link && (
            <a href={current.link.url} target="_blank" rel="noopener noreferrer" className={`mt-2 inline-block text-sm ${linkClass}`}>
              {current.link.label} ↗
            </a>
          )}
          {showCode && info.gmailCode && (
            <div className="mt-3 rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm">
              <p className="font-medium">Bestätigungscode von Google</p>
              {info.gmailCode.code && <p className="mt-1 font-mono text-2xl font-bold tracking-wider">{info.gmailCode.code}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                In Gmail eintragen und bestätigen{info.gmailCode.link ? " – oder direkt " : "."}
                {info.gmailCode.link && (
                  <a href={info.gmailCode.link} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    hier bestätigen ↗
                  </a>
                )}
              </p>
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-medium">3. Prüfen, ob es ankommt</p>
          {info.lastReceivedAt ? (
            <div className="mt-1.5 space-y-1.5">
              <p className="text-sm text-success">✓ Weiterleitung funktioniert – zuletzt empfangen {formatDateTime(info.lastReceivedAt)}</p>
              {info.recent.length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {info.recent.map((m) => (
                    <li key={`${m.at}-${m.subject}`} className="truncate">
                      {formatDateTime(m.at)} · {m.from} · {m.subject || "(ohne Betreff)"}
                      {m.handled ? " · als Anfrage übernommen" : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Noch keine Mail angekommen. Schicken Sie sich zum Test von einer anderen Adresse eine Mail – sie erscheint hier.
            </p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium">4. Einschalten</p>
          <div className="mt-1.5 space-y-3">
            <Field label="Ihre E-Mail-Adresse, an die Ihre Kunden schreiben" hint="Antworten Ihrer Kunden gehen an diese Adresse – und über die Weiterleitung auch an FallFlow.">
              <Input type="email" value={ownAddress} onChange={(e) => setOwnAddress(e.target.value)} placeholder="info@ihr-betrieb.de" disabled={!canManage} />
            </Field>
            {canManage && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" loading={pending} disabled={!ownAddress.includes("@")} onClick={activate}>
                  {info.active ? "Speichern" : "Weiterleitung einschalten"}
                </Button>
                {info.active && (
                  <Button variant="ghost" size="sm" disabled={pending} onClick={deactivate}>
                    Ausschalten
                  </Button>
                )}
              </div>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              FallFlow antwortet Ihren Kunden mit Ihrem Betriebsnamen als Absender. Rechnungen, Werbung und private Mails erkennt die KI und lässt sie liegen. Wer nur einen Teil
              weiterleiten möchte, kann in seinem Postfach stattdessen eine Regel anlegen (z. B. nur Mails vom Kontaktformular).
            </p>
            {!info.sendingAvailable && <Notice tone="error">Der Versand über FallFlow wird gerade noch eingerichtet – Antworten an Kunden werden erst danach verschickt.</Notice>}
            {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
          </div>
        </div>
      </div>
    </Card>
  );
}
