"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChannelBadge, StatusBadge } from "@/components/dashboard/badges";
import { CommunicationPanel } from "@/components/dashboard/communication";
import { EmptyState } from "@/components/ui/states";
import type { CaseMessage, CaseStatus, MessageChannel } from "@/lib/data/types";
import { MESSAGE_CHANNELS } from "@/lib/data/types";
import { cn, timeAgo } from "@/lib/utils";

export interface InboxThread {
  caseId: string;
  customerName: string;
  status: CaseStatus;
  hasEmail: boolean;
  hasPhone: boolean;
  /** Alle geladenen Nachrichten dieses Falls, älteste zuerst. */
  messages: CaseMessage[];
}

const CHANNEL_LABELS: Record<MessageChannel, string> = { website: "Website", email: "E-Mail", whatsapp: "WhatsApp", phone: "Telefon" };

/**
 * Posteingang, komplett im Browser: Die erste Seitenladung holt alle Unterhaltungen einmal vom Server,
 * das Wechseln zwischen Unterhaltungen und das Filtern nach Kanal passiert danach ohne weitere
 * Serveranfrage – kein spürbares Warten mehr beim Klick auf eine andere Nachricht.
 */
export function InboxBoard({ threads, canWrite }: { threads: InboxThread[]; canWrite: boolean }) {
  const [channel, setChannel] = useState<MessageChannel | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(threads[0]?.caseId ?? null);

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
  const filtered = channel ? enriched.filter((t) => t.channels.has(channel)) : enriched;
  const selected = filtered.find((t) => t.caseId === selectedId) ?? filtered[0];

  if (threads.length === 0) {
    return <EmptyState title="Keine Nachrichten in dieser Ansicht." description={"Sobald ein Kunde schreibt, erscheint die Unterhaltung hier.\nMit „Eingang simulieren“ können Sie den Ablauf ausprobieren."} />;
  }

  return (
    <div className="space-y-4">
      <nav aria-label="Kanal filtern" className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setChannel(null)}
          aria-current={!channel ? "true" : undefined}
          className={cn("rounded-full border px-3 py-1.5 text-sm", !channel ? "border-accent bg-accent-soft text-accent" : "border-border bg-card hover:bg-muted")}
        >
          Alle ({enriched.length})
        </button>
        {MESSAGE_CHANNELS.map((ch) => (
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
        <EmptyState title="Keine Nachrichten in dieser Ansicht." />
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
                    <p className="truncate text-sm font-medium">{t.customerName}</p>
                    {t.last && <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(t.last.createdAt)}</span>}
                  </div>
                  {t.last && <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.last.content}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {[...t.channels].map((ch) => (
                      <ChannelBadge key={ch} channel={ch} simulated={t.last?.simulated && ch === t.last.channel} />
                    ))}
                    <StatusBadge status={t.status} />
                    {t.unsent && <span className="text-xs text-warning">nicht versendet</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{selected.customerName}</h2>
                <Link href={`/dashboard/cases/${selected.caseId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                  Fallakte öffnen <ExternalLink className="size-3.5" aria-hidden />
                </Link>
              </div>
              <CommunicationPanel key={selected.caseId} caseId={selected.caseId} messages={selected.messages} canWrite={canWrite} hasEmail={selected.hasEmail} hasPhone={selected.hasPhone} title="Unterhaltung" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
