import type { Metadata } from "next";
import { InboxBoard, type InboxThread } from "@/components/dashboard/inbox-board";
import { InboxSimulator } from "@/components/dashboard/inbox-simulator";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
import { Badge, PageHeader } from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import type { CaseMessage } from "@/lib/data/types";

export const metadata: Metadata = { title: "Posteingang" };

/**
 * Zentraler Posteingang: alle Kanäle in einem Verlauf, jede Nachricht ist dem richtigen Fall zugeordnet.
 * Die Daten werden einmal geladen; das Wechseln zwischen Unterhaltungen läuft danach im Browser
 * (siehe InboxBoard), ohne dass jeder Klick eine neue Serveranfrage auslöst.
 */
export default async function InboxPage() {
  const session = await requireSession();
  const store = await getStore(session);
  const [cases, recent, channels] = await Promise.all([store.listCases(), store.listRecentMessages(400), store.listChannels()]);
  const caseById = new Map(cases.map((c) => [c.id, c]));

  const byCase = new Map<string, CaseMessage[]>();
  for (const m of recent) byCase.set(m.caseId, [...(byCase.get(m.caseId) ?? []), m]);

  const threads: InboxThread[] = [...byCase.entries()]
    .filter(([id]) => caseById.has(id))
    .map(([id, msgs]) => {
      const c = caseById.get(id)!;
      return { caseId: id, customerName: c.customerName, status: c.status, hasEmail: Boolean(c.fields.email), hasPhone: Boolean(c.fields.phone), messages: [...msgs].reverse() };
    })
    .sort((a, b) => (b.messages.at(-1)?.createdAt ?? "").localeCompare(a.messages.at(-1)?.createdAt ?? ""));

  const canWrite = can(session.role, "cases:write");

  const connected = (k: "website" | "gmail" | "microsoft" | "whatsapp") => channels.find((c) => c.kind === k)?.status === "connected";
  const channelState: { label: string; ok: boolean; note: string }[] = [
    { label: "Website-Chat", ok: connected("website"), note: connected("website") ? "verbunden" : "nicht verbunden" },
    { label: "E-Mail", ok: connected("gmail") || connected("microsoft"), note: connected("gmail") || connected("microsoft") ? "verbunden" : "nicht verbunden · Demo-Modus" },
    { label: "WhatsApp", ok: connected("whatsapp"), note: connected("whatsapp") ? "verbunden" : "nicht verbunden · Demo-Modus" },
    { label: "Telefon", ok: true, note: "manuelle Notizen" },
  ];

  return (
    <>
      <LiveRefresh active everyMs={15000} />
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

      <InboxBoard threads={threads} canWrite={canWrite} />
    </>
  );
}
