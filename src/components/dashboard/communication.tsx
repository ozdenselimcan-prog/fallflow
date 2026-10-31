"use client";

import { Languages, Phone, RotateCw, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import type { CaseMessage } from "@/lib/data/types";
import { apiFetch, useMutation } from "@/lib/use-api";
import { cn, formatDateTime } from "@/lib/utils";
import { ChannelBadge } from "./badges";

const ROLE_LABEL = { user: "Kunde", assistant: "KI", staff: "Team" } as const;

/** „Erneut senden“ für eine E-Mail, die nicht versendet werden konnte (z. B. Tageslimit des Postfachs erreicht). */
function ResendButton({ caseId, messageId }: { caseId: string; messageId: string }) {
  const { pending, error, run } = useMutation();
  const [reason, setReason] = useState<string | null>(null);
  async function resend() {
    setReason(null);
    const res = await run(() => apiFetch<{ delivered: boolean; reason: string }>("POST", `/api/cases/${caseId}/resend`, { messageId }));
    if (res && !res.delivered) setReason(res.reason || "Versand fehlgeschlagen.");
  }
  return (
    <>
      <button type="button" onClick={resend} disabled={pending} className="inline-flex items-center gap-1 font-medium text-accent hover:underline disabled:opacity-50">
        <RotateCw className={cn("size-3", pending && "animate-spin")} aria-hidden /> Erneut senden
      </button>
      {(reason || error) && <span className="basis-full text-warning">{reason ?? error}</span>}
    </>
  );
}

/** Fremdsprachige Nachricht fürs Büro auf Deutsch anzeigen (auf Klick, wird nicht gespeichert). */
function TranslateButton({ caseId, messageId, onText }: { caseId: string; messageId: string; onText: (t: string) => void }) {
  const { pending, error, run } = useMutation();
  async function translate() {
    const res = await run(() => apiFetch<{ text: string }>("POST", `/api/cases/${caseId}/translate`, { messageId }), { refresh: false });
    if (res) onText(res.text);
  }
  return (
    <>
      <button type="button" onClick={translate} disabled={pending} className="inline-flex items-center gap-1 font-medium text-accent hover:underline disabled:opacity-50">
        <Languages className={cn("size-3", pending && "animate-pulse")} aria-hidden /> Auf Deutsch
      </button>
      {error && <span className="basis-full text-warning">{error}</span>}
    </>
  );
}

/** Chronologischer Gesprächsverlauf über alle Kanäle mit Zustellstatus – nichts wird als „gesendet“ gezeigt, was nicht versendet wurde. */
export function MessageThread({
  messages,
  className,
  resendCaseId,
  translateCaseId,
}: {
  messages: CaseMessage[];
  className?: string;
  /** gesetzt = „Erneut senden“ anbieten */
  resendCaseId?: string;
  /** gesetzt = Kunde schreibt in einer anderen Sprache: „Auf Deutsch“ anbieten */
  translateCaseId?: string;
}) {
  const [german, setGerman] = useState<Record<string, string>>({});
  if (messages.length === 0) return <p className="text-sm text-muted-foreground">Noch keine Nachrichten.</p>;
  return (
    <div className={cn("space-y-3 overflow-y-auto", className)}>
      {messages.map((m) => (
        <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
          <div className={cn("mb-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground", m.role === "user" && "justify-end")}>
            <span className="font-medium">{ROLE_LABEL[m.role]}</span>
            <ChannelBadge channel={m.channel} simulated={m.simulated} />
            {m.delivery === "not_sent" && <span className="text-warning">nicht versendet</span>}
            {m.delivery === "not_sent" && resendCaseId && m.channel === "email" && m.role !== "user" && !m.simulated && <ResendButton caseId={resendCaseId} messageId={m.id} />}
            {m.delivery === "internal" && <span>interne Notiz</span>}
            {translateCaseId && m.delivery !== "internal" && !german[m.id] && <TranslateButton caseId={translateCaseId} messageId={m.id} onText={(t) => setGerman((g) => ({ ...g, [m.id]: t }))} />}
            <span>{formatDateTime(m.createdAt)}</span>
          </div>
          <span
            className={cn(
              "inline-block max-w-[92%] rounded-2xl px-3 py-2 text-left text-sm whitespace-pre-line",
              m.role === "user" ? "bg-accent text-white" : m.role === "staff" ? "border border-dashed border-border bg-card" : "bg-muted",
            )}
          >
            {m.content}
            {german[m.id] && <span className="mt-2 block border-t border-current/20 pt-2 text-xs opacity-90">Deutsch: {german[m.id]}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  caseId: string;
  messages: CaseMessage[];
  canWrite: boolean;
  hasEmail: boolean;
  /** Kunde kam per WhatsApp: Nachrichten des Teams gehen per WhatsApp raus (ohne Betreff). */
  whatsapp?: boolean;
  title?: string;
  /** Sprache des Kunden, wenn nicht Deutsch (z. B. „Türkisch“): Nachrichten werden übersetzt gesendet. */
  language?: string;
}

/** Kommunikation eines Falls: Verlauf, Telefonnotiz (Angaben werden übernommen) und Nachricht an den Kunden. */
export function CommunicationPanel({ caseId, messages, canWrite, hasEmail, whatsapp = false, title = "Kommunikation", language }: Props) {
  const { pending, error, run } = useMutation();
  const [mode, setMode] = useState<"phone_note" | "email">("phone_note");
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [translate, setTranslate] = useState(true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setInfo(null);
    const res = await run(() =>
      apiFetch<{ added?: string[]; delivered?: boolean; reason?: string }>("POST", "/api/messages", {
        caseId,
        content: text,
        kind: mode,
        ...(mode === "email" && !whatsapp && subject.trim() ? { subject: subject.trim() } : {}),
        ...(language ? { translate } : {}),
      }),
    );
    if (!res) return;
    setText("");
    setSubject("");
    if (mode === "phone_note") setInfo(res.added?.length ? "Notiz gespeichert. Erkannte Angaben wurden in die Fallakte übernommen." : "Notiz gespeichert.");
    else setInfo(res.delivered ? (language && translate ? `Nachricht auf ${language} übersetzt gesendet.` : "Nachricht gesendet.") : `Nachricht gespeichert, aber nicht versendet. ${res.reason ?? ""}`);
  }

  const channelReady = mode === "phone_note" || hasEmail;
  // KI-Entwurf: Stellen in [bitte ergänzen: …] müssen vor dem Senden ausgefüllt werden.
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const openGaps = mode !== "phone_note" && /\[bitte ergänzen/i.test(text);
  async function draft() {
    setDrafting(true);
    setDraftError(null);
    setInfo(null);
    try {
      const r = await apiFetch<{ text: string }>("POST", `/api/cases/${caseId}/reply-draft`);
      setMode("email");
      setText(r.text);
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "Entwurf fehlgeschlagen");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <Card>
      <CardHeader title={title} description={whatsapp ? "WhatsApp-Nachrichten und Telefonnotizen in einem Verlauf" : "E-Mails und Telefonnotizen in einem Verlauf"} />
      <div className="space-y-4 px-5 py-4">
        {language && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Languages className="size-3.5" aria-hidden /> Kunde schreibt auf {language} – automatische Antworten gehen auf {language} raus.
          </p>
        )}
        <MessageThread messages={messages} className="max-h-96" resendCaseId={canWrite && hasEmail ? caseId : undefined} translateCaseId={language ? caseId : undefined} />
        {canWrite && (
          <form onSubmit={submit} className="space-y-2 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`mode-${caseId}`}>
                Art des Eintrags
              </label>
              <Select id={`mode-${caseId}`} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="h-9 w-auto">
                <option value="phone_note">Telefonnotiz</option>
                <option value="email">{whatsapp ? "Nachricht per WhatsApp" : "Nachricht per E-Mail"}</option>
              </Select>
              {hasEmail && (
                <Button type="button" variant="ghost" size="sm" onClick={draft} loading={drafting} className="ml-auto">
                  <Sparkles className="size-3.5" /> KI-Entwurf
                </Button>
              )}
              {!channelReady && <span className="text-xs text-warning">{whatsapp ? "Dafür fehlt die WhatsApp-Nummer im Fall." : "Dafür fehlt eine E-Mail-Adresse im Fall."}</span>}
            </div>
            {mode === "email" && !whatsapp && (
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                placeholder="Betreff (leer = „Ihre Anfrage“)"
                aria-label="Betreff"
              />
            )}
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              placeholder={mode === "phone_note" ? "Was wurde besprochen? Angaben des Kunden werden automatisch übernommen …" : "Nachricht an den Kunden …"}
              aria-label="Nachricht"
              className="min-h-20"
            />
            {language && mode === "email" && <Checkbox label={`Auf Deutsch schreiben, auf ${language} übersetzt senden`} checked={translate} onChange={setTranslate} />}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {mode === "phone_note"
                  ? "Interne Notiz – wird nicht an den Kunden gesendet."
                  : openGaps
                    ? "Bitte die Stellen in [bitte ergänzen: …] ausfüllen – dann können Sie senden."
                    : "Wird nur versendet, wenn der Kanal verbunden ist – sonst nur gespeichert."}
              </p>
              <Button type="submit" size="sm" className="shrink-0 whitespace-nowrap" loading={pending} disabled={!text.trim() || !channelReady || openGaps}>
                {mode === "phone_note" ? <Phone className="size-3.5" /> : <Send className="size-3.5" />}
                {mode === "phone_note" ? "Notiz speichern" : "Senden"}
              </Button>
            </div>
            {(error || draftError) && <Notice tone="error">{error ?? draftError}</Notice>}
            {info && <Notice tone="info">{info}</Notice>}
          </form>
        )}
      </div>
    </Card>
  );
}
