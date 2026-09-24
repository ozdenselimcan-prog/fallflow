import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ChannelBadge, StatusBadge } from "@/components/dashboard/badges";
import { CommunicationPanel } from "@/components/dashboard/communication";
import { InboxSimulator } from "@/components/dashboard/inbox-simulator";
import { Badge, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { MESSAGE_CHANNELS, type CaseMessage, type MessageChannel } from "@/lib/data/types";
import { cn, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Posteingang" };

const CHANNEL_LABELS: Record<MessageChannel, string> = { website: "Website", email: "E-Mail", whatsapp: "WhatsApp", phone: "Telefon" };

/** Zentraler Posteingang: alle Kanäle in einem Verlauf, jede Nachricht ist dem richtigen Fall zugeordnet. */
export default async function InboxPage({ searchParams }: PageProps<"/dashboard/inbox">) {
  const raw = await searchParams;
  const channelParam = typeof raw.channel === "string" ? raw.channel : "";
  const channel = (MESSAGE_CHANNELS as readonly string[]).includes(channelParam) ? (channelParam as MessageChannel) : null;
  const selectedParam = typeof raw.case === "string" ? raw.case : "";

  const session = await requireSession();
  const store = await getStore(session);
  const [cases, recent, channels] = await Promise.all([store.listCases(), store.listRecentMessages(400), store.listChannels()]);
  const caseById = new Map(cases.map((c) => [c.id, c]));

  // Threads = ein Fall mit all seinen Nachrichten; sortiert nach der letzten Nachricht.
  const byCase = new Map<string, CaseMessage[]>();
  for (const m of recent) byCase.set(m.caseId, [...(byCase.get(m.caseId) ?? []), m]);
  const allThreads = [...byCase.entries()]
    .filter(([id]) => caseById.has(id))
    .map(([id, msgs]) => ({ c: caseById.get(id)!, last: msgs[0], channels: new Set(msgs.map((m) => m.channel)), unsent: msgs.some((m) => m.delivery === "not_sent") }))
    .sort((a, b) => b.last.createdAt.localeCompare(a.last.createdAt));

  const counts = Object.fromEntries(MESSAGE_CHANNELS.map((ch) => [ch, allThreads.filter((t) => t.channels.has(ch)).length])) as Record<MessageChannel, number>;
  const threads = channel ? allThreads.filter((t) => t.channels.has(channel)) : allThreads;
  const selected = threads.find((t) => t.c.id === selectedParam) ?? threads[0];
  const messages = selected ? await store.listMessages(selected.c.id) : [];
  const canWrite = can(session.role, "cases:write");

  const connected = (k: "website" | "gmail" | "microsoft" | "whatsapp") => channels.find((c) => c.kind === k)?.status === "connected";
  const channelState: { label: string; ok: boolean; note: string }[] = [
    { label: "Website-Chat", ok: connected("website"), note: connected("website") ? "verbunden" : "nicht verbunden" },
    { label: "E-Mail", ok: connected("gmail") || connected("microsoft"), note: connected("gmail") || connected("microsoft") ? "verbunden" : "nicht verbunden · Demo-Modus" },
    { label: "WhatsApp", ok: connected("whatsapp"), note: connected("whatsapp") ? "verbunden" : "nicht verbunden · Demo-Modus" },
    { label: "Telefon", ok: true, note: "manuelle Notizen" },
  ];

  const href = (params: { channel?: string | null; case?: string }) => {
    const q = new URLSearchParams();
    if (params.channel) q.set("channel", params.channel);
    if (params.case) q.set("case", params.case);
    const s = q.toString();
    return `/dashboard/inbox${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Posteingang" description="Website, E-Mail, WhatsApp und Telefonnotizen – jede Nachricht wird automatisch dem richtigen Kunden und Fall zugeordnet." action={canWrite ? <InboxSimulator /> : undefined} />

      <ul className="mb-5 flex flex-wrap gap-2" aria-label="Kanalstatus">
        {channelState.map((c) => (
          <li key={c.label}>
            <Badge tone={c.ok ? "success" : "neutral"}>
              {c.label}: {c.note}
            </Badge>
          </li>
        ))}
      </ul>

      <nav aria-label="Kanal filtern" className="mb-4 flex flex-wrap gap-2">
        <Link href={href({})} aria-current={!channel ? "true" : undefined} className={cn("rounded-full border px-3 py-1.5 text-sm", !channel ? "border-accent bg-accent-soft text-accent" : "border-border bg-card hover:bg-muted")}>
          Alle ({allThreads.length})
        </Link>
        {MESSAGE_CHANNELS.map((ch) => (
          <Link key={ch} href={href({ channel: ch })} aria-current={channel === ch ? "true" : undefined} className={cn("rounded-full border px-3 py-1.5 text-sm", channel === ch ? "border-accent bg-accent-soft text-accent" : "border-border bg-card hover:bg-muted")}>
            {CHANNEL_LABELS[ch]} ({counts[ch]})
          </Link>
        ))}
      </nav>

      {threads.length === 0 ? (
        <EmptyState title="Keine Nachrichten in dieser Ansicht." description={"Sobald ein Kunde schreibt, erscheint die Unterhaltung hier.\nMit „Eingang simulieren“ können Sie den Ablauf ausprobieren."} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <ul className="max-h-[42rem] divide-y divide-border overflow-y-auto rounded-2xl border border-border bg-card">
            {threads.map((t) => (
              <li key={t.c.id}>
                <Link href={href({ channel, case: t.c.id })} aria-current={selected?.c.id === t.c.id ? "true" : undefined} className={cn("block px-4 py-3 hover:bg-background/70", selected?.c.id === t.c.id && "bg-accent-soft/60")}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium">{t.c.customerName}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(t.last.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.last.content}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {[...t.channels].map((ch) => (
                      <ChannelBadge key={ch} channel={ch} simulated={t.last.simulated && ch === t.last.channel} />
                    ))}
                    <StatusBadge status={t.c.status} />
                    {t.unsent && <span className="text-xs text-warning">nicht versendet</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {selected && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{selected.c.customerName}</h2>
                <Link href={`/dashboard/cases/${selected.c.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                  Fallakte öffnen <ExternalLink className="size-3.5" aria-hidden />
                </Link>
              </div>
              <CommunicationPanel
                key={selected.c.id}
                caseId={selected.c.id}
                messages={messages}
                canWrite={canWrite}
                hasEmail={Boolean(selected.c.fields.email)}
                hasPhone={Boolean(selected.c.fields.phone)}
                title="Unterhaltung"
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
