import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, CheckCircle2, Hourglass, Inbox, PartyPopper, Sparkles } from "lucide-react";
import { CaseTable } from "@/components/dashboard/case-table";
import { Card, CardHeader } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { buildAttention } from "@/lib/intake/attention";
import { buildCaseMeta } from "@/lib/intake/meta";
import { cn, greeting, relativeDay, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const dot = { accent: "bg-accent", warning: "bg-warning", success: "bg-success" } as const;

export default async function DashboardPage() {
  const session = await requireSession();
  const store = await getStore(session);
  const [stats, cases, documents, followUps, appointments, events, questions] = await Promise.all([
    store.getStats(),
    store.listCases({ sort: "newest" }),
    store.listDocuments(),
    store.listFollowUps(),
    store.listAppointments(),
    store.listRecentEvents(12),
    store.listQuestions(),
  ]);

  const tiles = [
    { label: "Neue Anfragen", value: stats.newRequests, icon: Inbox, href: "/dashboard/intake?status=NEW" },
    { label: "Vollständige Fälle", value: stats.completeCases, icon: CheckCircle2, href: "/dashboard/cases?status=READY_FOR_REVIEW" },
    { label: "Warten auf Kundendaten", value: stats.waitingForCustomer, icon: Hourglass, href: "/dashboard/intake?status=WAITING_FOR_CUSTOMER" },
    { label: "Heute anstehende Termine", value: stats.appointmentsToday, icon: CalendarCheck, href: "/dashboard/calendar" },
    { label: "Automatisch qualifizierte Leads", value: stats.autoQualified, icon: Sparkles, href: "/dashboard/intake" },
  ];

  const attention = buildAttention({ cases, documents, followUps, appointments });
  const active = cases.filter((c) => c.status !== "CONVERTED").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const meta = buildCaseMeta(active, questions, documents);
  const nameOf = new Map(cases.map((c) => [c.id, c.customerName]));
  const upcoming = followUps.filter((f) => f.status === "planned" || f.status === "manual").slice(0, 4);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting()}
          {session.firstName ? `, ${session.firstName}` : ""}.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Von der ersten Kundenanfrage zum vollständig vorbereiteten Beratungsfall.</p>
      </div>

      <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {tiles.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="group rounded-2xl border border-border bg-card p-4 transition-colors hover:border-accent/50 sm:p-5">
            <div className="flex items-start justify-between gap-2 text-muted-foreground">
              <span className="text-sm leading-snug">{label}</span>
              <Icon className="size-4 shrink-0" aria-hidden />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
          </Link>
        ))}
      </section>

      <section aria-labelledby="attention-title">
        <h2 id="attention-title" className="mb-3 text-lg font-semibold">
          Anfragen, die deine Aufmerksamkeit brauchen
        </h2>
        {attention.length === 0 ? (
          <Card className="flex items-center gap-3 px-5 py-6 text-sm text-muted-foreground">
            <PartyPopper className="size-5 text-success" aria-hidden /> Alles erledigt – im Moment gibt es nichts, das deine Aufmerksamkeit braucht.
          </Card>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {attention.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="flex items-center gap-3 px-5 py-4 text-sm hover:bg-background/70">
                  <span className={cn("size-2 shrink-0 rounded-full", dot[item.tone])} aria-hidden />
                  <span className="flex-1 font-medium">{item.text}</span>
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Aktuelle Vorgänge</h2>
            <Link href="/dashboard/intake" className="text-sm font-medium text-accent hover:underline">
              Alle im AI Intake
            </Link>
          </div>
          <CaseTable cases={active} meta={meta} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="KI-Aktivitäten" description="Was FallFlow zuletzt automatisch erledigt hat" />
            <ol className="space-y-3 px-5 py-4">
              {events.length === 0 && <li className="text-sm text-muted-foreground">Noch keine Aktivitäten.</li>}
              {events.slice(0, 8).map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm">{e.text}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <Link href={`/dashboard/cases/${e.caseId}`} className="hover:underline">
                        {nameOf.get(e.caseId) ?? "Fall"}
                      </Link>{" "}
                      · {timeAgo(e.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader title="Geplante Follow-ups" />
            <ul className="space-y-3 px-5 py-4">
              {upcoming.length === 0 && <li className="text-sm text-muted-foreground">Keine Follow-ups geplant.</li>}
              {upcoming.map((f) => (
                <li key={f.id} className="text-sm">
                  <Link href={`/dashboard/cases/${f.caseId}`} className="font-medium hover:underline">
                    {nameOf.get(f.caseId) ?? "Fall"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {f.status === "manual" ? "Fällig – manuell senden" : `Follow-up geplant für ${relativeDay(f.scheduledFor)}`} · {f.kind === "document" ? "Dokument fehlt" : "Angaben fehlen"}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
      </div>
    </div>
  );
}
