"use client";

import { Phone, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import type { CaseMessage } from "@/lib/data/types";
import { apiFetch, useMutation } from "@/lib/use-api";
import { cn, formatDateTime } from "@/lib/utils";
import { ChannelBadge } from "./badges";

const ROLE_LABEL = { user: "Kunde", assistant: "KI", staff: "Team" } as const;

/** Chronologischer Gesprächsverlauf über alle Kanäle mit Zustellstatus – nichts wird als „gesendet“ gezeigt, was nicht versendet wurde. */
export function MessageThread({ messages, className }: { messages: CaseMessage[]; className?: string }) {
  if (messages.length === 0) return <p className="text-sm text-muted-foreground">Noch keine Nachrichten.</p>;
  return (
    <div className={cn("space-y-3 overflow-y-auto", className)}>
      {messages.map((m) => (
        <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
          <div className={cn("mb-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground", m.role === "user" && "justify-end")}>
            <span className="font-medium">{ROLE_LABEL[m.role]}</span>
            <ChannelBadge channel={m.channel} simulated={m.simulated} />
            {m.delivery === "not_sent" && <span className="text-warning">nicht versendet</span>}
            {m.delivery === "internal" && <span>interne Notiz</span>}
            <span>{formatDateTime(m.createdAt)}</span>
          </div>
          <span
            className={cn(
              "inline-block max-w-[92%] rounded-2xl px-3 py-2 text-left text-sm whitespace-pre-line",
              m.role === "user" ? "bg-accent text-white" : m.role === "staff" ? "border border-dashed border-border bg-card" : "bg-muted",
            )}
          >
            {m.content}
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
  hasPhone: boolean;
  title?: string;
}

/** Kommunikation eines Falls: Verlauf, Telefonnotiz (Angaben werden übernommen) und Nachricht an den Kunden. */
export function CommunicationPanel({ caseId, messages, canWrite, hasEmail, hasPhone, title = "Kommunikation" }: Props) {
  const { pending, error, run } = useMutation();
  const [mode, setMode] = useState<"phone_note" | "email" | "whatsapp">("phone_note");
  const [text, setText] = useState("");
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setInfo(null);
    const res = await run(() => apiFetch<{ added?: string[]; delivered?: boolean; reason?: string }>("POST", "/api/messages", { caseId, content: text, kind: mode }));
    if (!res) return;
    setText("");
    if (mode === "phone_note") setInfo(res.added?.length ? "Notiz gespeichert. Erkannte Angaben wurden in die Fallakte übernommen." : "Notiz gespeichert.");
    else setInfo(res.delivered ? "Nachricht gesendet." : `Nachricht gespeichert, aber nicht versendet. ${res.reason ?? ""}`);
  }

  const channelReady = mode === "phone_note" || (mode === "email" ? hasEmail : hasPhone);

  return (
    <Card>
      <CardHeader title={title} description="Website-Chat, E-Mail, WhatsApp und Telefonnotizen in einem Verlauf" />
      <div className="space-y-4 px-5 py-4">
        <MessageThread messages={messages} className="max-h-96" />
        {canWrite && (
          <form onSubmit={submit} className="space-y-2 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`mode-${caseId}`}>
                Art des Eintrags
              </label>
              <Select id={`mode-${caseId}`} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="h-9 w-auto">
                <option value="phone_note">Telefonnotiz</option>
                <option value="email">Nachricht per E-Mail</option>
                <option value="whatsapp">Nachricht per WhatsApp</option>
              </Select>
              {!channelReady && <span className="text-xs text-warning">Dafür fehlt {mode === "email" ? "eine E-Mail-Adresse" : "eine Telefonnummer"} im Fall.</span>}
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              placeholder={mode === "phone_note" ? "Was wurde besprochen? Angaben wie Baujahr oder Heizung werden übernommen …" : "Nachricht an den Kunden …"}
              aria-label="Nachricht"
              className="min-h-20"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {mode === "phone_note" ? "Interne Notiz – wird nicht an den Kunden gesendet." : "Wird nur versendet, wenn der Kanal verbunden ist – sonst nur gespeichert."}
              </p>
              <Button type="submit" size="sm" loading={pending} disabled={!text.trim() || !channelReady}>
                {mode === "phone_note" ? <Phone className="size-3.5" /> : <Send className="size-3.5" />}
                {mode === "phone_note" ? "Notiz speichern" : "Senden"}
              </Button>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            {info && <Notice tone="info">{info}</Notice>}
          </form>
        )}
      </div>
    </Card>
  );
}
