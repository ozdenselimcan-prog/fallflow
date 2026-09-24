import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, CheckCircle2, HelpCircle, Inbox } from "lucide-react";
import { CaseTable } from "@/components/dashboard/case-table";
import { Card } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { greeting } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireSession();
  const store = await getStore(session);
  const [stats, cases] = await Promise.all([store.getStats(), store.listCases({ sort: "newest" })]);

  const tiles = [
    { label: "Neue Anfragen", value: stats.newRequests, icon: Inbox },
    { label: "Vollständige Fälle", value: stats.completeCases, icon: CheckCircle2 },
    { label: "Rückfragen offen", value: stats.openQuestions, icon: HelpCircle },
    { label: "Termine", value: stats.appointments, icon: CalendarCheck },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {greeting()}
        {session.firstName ? `, ${session.firstName}` : ""}.
      </h1>

      <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-sm">{label}</span>
              <Icon className="size-4" />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
          </Card>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Neue Beratungsfälle</h2>
          <Link href="/dashboard/cases" className="text-sm font-medium text-accent hover:underline">
            Alle ansehen
          </Link>
        </div>
        <CaseTable cases={cases.slice(0, 6)} />
      </section>
    </div>
  );
}
