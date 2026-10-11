"use client";

import { AlertCircle, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChannelBadge, StatusBadge } from "@/components/dashboard/badges";
import { CommunicationPanel } from "@/components/dashboard/communication";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { apiFetch, useMutation } from "@/lib/use-api";
import type { CaseMessage, CaseStatus, MessageChannel } from "@/lib/data/types";
import { MESSAGE_CHANNELS } from "@/lib/data/types";
import { cn, timeAgo } from "@/lib/utils";

export interface InboxThread {
  caseId: string;
  customerName: string;
  email: string;
  status: CaseStatus;
  hasEmail: boolean;
  /** Grund für "Aufmerksamkeit benötigt" (KI hat bewusst nicht automatisch geantwortet), sonst leer. */
  attention: string;
  /** Alle geladenen Nachrichten dieses Falls, älteste zuerst. */
  messages: CaseMessage[];
}

/** Solange kein Name bekannt ist (z. B. bei E-Mail-Anfragen ohne erkannten Absendernamen), die
 * E-Mail-Adresse statt "Unbekannt" anzeigen – besser als Platzhalter. */
const displayName = (t: Pick<InboxThread, "customerName" | "email">) => (t.customerName && t.customerName !== "Unbekannt" ? t.customerName : t.email || t.customerName);

const CHANNEL_LABELS: Record<MessageChannel, string> = { website: "Website", email: "E-Mail", phone: "Telefon" };

/**
 * Posteingang, komplett im Browser: Die erste Seitenladung holt alle Unterhaltungen einmal vom Server,
 * das Wechseln zwischen Unterhaltungen und das Filtern nach Kanal passiert danach ohne weitere
 * Serveranfrage – kein spürbares Warten mehr beim Klick auf eine andere Nachricht.
 */
export function InboxBoard({ threads, canWrite }: { threads: InboxThread[]; canWrite: boolean }) {
  const attentionCount = threads.filter((t) => t.attention).length;
  // "attention" = nur Unterhaltungen, auf die der Energieberater selbst antworten soll.
  const [channel, setChannel] = useState<MessageChannel | "attention" | null>(attentionCount ? "attention" : null);
  const [selectedId, setSelectedId] = useState<string | null>((threads.find((t) => t.attention) ?? threads[0])?.caseId ?? null);
  const { pending, error, run } = useMutation();

  const enriched = useMemo(
    () =>
      threads.map((t) => {
        const last = t.messages[t.messages.length - 1];
        return { ...t, last, channels: new Set(t.messages.map((m) => m.channel)), unsent: t.messages.some((m) => m.delivery === "not_sent") };
      }),
    [threads],
  );

  const counts = useMemo(
    () => Object.fromEntries(MESSAGE_CHANNELS.map((ch) => [ch, enriched.filter((t) => t.channels.has(ch)).length])) as Record<MessageChannel, number>,
    [enriched],
  );
  const filtered = channel === "attention" ? enriched.filter((t) => t.attention) : channel ? enriched.filter((t) => t.channels.has(channel)) : enriched;
  const selected = filtered.find((t) => t.caseId === selectedId) ?? filtered[0];

  if (threads.length === 0) {
    return <EmptyState title="Keine Nachrichten in dieser Ansicht." description="Sobald ein Kunde schreibt, erscheint die Unterhaltung hier." />;
  }

  return (
    <div className="space-y-4">
      <nav aria-label="Kanal filtern" className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setChannel("attention")}
          aria-current={channel === "attention" ? "true" : undefined}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
            channel === "attention" ? "border-warning bg-warning-soft text-warning" : attentionCount ? "border-warning/50 bg-card text-warning hover:bg-warning-soft" : "border-border bg-card hover:bg-muted",
          )}
        >
          <AlertCircle className="size-3.5" aria-hidden /> Aufmerksamkeit benötigt ({attentionCount})
        </button>
        <button
          type="button"
          onClick={() => setChannel(null)}
          aria-current={!channel ? "true" : undefined}
          className={cn("rounded-full border px-3 py-1.5 text-sm", !channel ? "border-accent bg-accent-soft text-accent" : "border-border bg-card hover:bg-muted")}
        >
          Alle ({enriched.length})
        </button>
        {MESSAGE_CHANNELS.filter((ch) => ch !== "website" || counts[ch] > 0).map((ch) => (
          <button
            key={ch}
            type="button"
            onClick={() => setChannel(ch)}
            aria-current={channel === ch ? "true" : undefined}
            className={cn("rounded-full border px-3 py-1.5 text-sm", channel === ch ? "border-accent bg-accent-soft text-accent" : "border-border bg-card hover:bg-muted")}
          >
            {CHANNEL_LABELS[ch]} ({counts[ch]})
          </button>
        ))}
      </nav>

      {filtered.length === 0 ? (
        <EmptyState
          title={channel === "attention" ? "Nichts zu tun." : "Keine Nachrichten in dieser Ansicht."}
          description={channel === "attention" ? "Mails mit Fragen oder unklarer Leistung erscheinen hier – darauf antwortet die KI nicht automatisch." : undefined}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <ul className="max-h-[42rem] divide-y divide-border overflow-y-auto rounded-2xl border border-border bg-card">
            {filtered.map((t) => (
              <li key={t.caseId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(t.caseId)}
                  aria-current={selected?.caseId === t.caseId ? "true" : undefined}
                  className={cn("block w-full px-4 py-3 text-left hover:bg-background/70", selected?.caseId === t.caseId && "bg-accent-soft/60")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium">{displayName(t)}</p>
                    {t.last && <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(t.last.createdAt)}</span>}
                  </div>
                  {t.last && <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.last.content}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {[...t.channels].map((ch) => (
                      <ChannelBadge key={ch} channel={ch} simulated={t.last?.simulated && ch === t.last.channel} />
                    ))}
                    <StatusBadge status={t.status} />
                    {t.unsent && <span className="text-xs text-warning">nicht versendet</span>}
                    {t.attention && <span className="text-xs font-medium text-warning">Aufmerksamkeit benötigt</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{displayName(selected)}</h2>
                <Link href={`/dashboard/cases/${selected.caseId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                  Fallakte öffnen <ExternalLink className="size-3.5" aria-hidden />
                </Link>
              </div>
              {selected.attention && (
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
                  <p>
                    <span className="font-medium text-warning">Aufmerksamkeit benötigt: </span>
                    {selected.attention.replace(/[.?!]+$/, "")}. Die KI hat bewusst nicht automatisch geantwortet – bitte antworten Sie dem Kunden selbst (unten oder in Ihrem
                    E-Mail-Programm).
                  </p>
                  {canWrite && (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={pending}
                      onClick={() => run(() => apiFetch("PATCH", `/api/cases/${selected.caseId}`, { resolveAttention: true }))}
                    >
                      <Check className="size-3.5" /> Erledigt
                    </Button>
                  )}
                  {error && <p className="w-full text-danger">{error}</p>}
                </div>
              )}
              <CommunicationPanel key={selected.caseId} caseId={selected.caseId} messages={selected.messages} canWrite={canWrite} hasEmail={selected.hasEmail} title="Unterhaltung" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
