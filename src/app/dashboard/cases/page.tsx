import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { CaseTable } from "@/components/dashboard/case-table";
import { Button, buttonStyles } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { SERVICES, STATUS_LABELS } from "@/lib/cases/fields";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { daysAgoIso } from "@/lib/utils";
import { caseQuerySchema } from "@/lib/validation";
import { CASE_STATUSES } from "@/lib/data/types";

export const metadata: Metadata = { title: "Beratungsfälle" };

const DATE_RANGES = [
  { value: "", label: "Alle" },
  { value: "7", label: "Letzte 7 Tage" },
  { value: "30", label: "Letzte 30 Tage" },
  { value: "90", label: "Letzte 90 Tage" },
];

export default async function CasesPage({ searchParams }: PageProps<"/dashboard/cases">) {
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v));
  const days = Number(flat.days);
  const parsed = caseQuerySchema.safeParse({ ...flat, from: days > 0 ? daysAgoIso(days) : undefined });
  const filters = parsed.success ? parsed.data : {};
  const hasFilters = Object.keys(flat).length > 0;

  const session = await requireSession();
  const store = await getStore(session);
  const cases = await store.listCases(filters);

  return (
    <>
      <PageHeader title="Beratungsfälle" description={`${cases.length} ${cases.length === 1 ? "Fall" : "Fälle"}${hasFilters ? " (gefiltert)" : ""}`} />

      <form method="get" className="mb-5 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={filters.q} placeholder="Name, E-Mail, PLZ suchen …" className="pl-9" aria-label="Suche" />
        </div>
        <Select name="status" defaultValue={filters.status ?? ""} aria-label="Status">
          <option value="">Alle Status</option>
          {CASE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select name="service" defaultValue={filters.service ?? ""} aria-label="Leistung">
          <option value="">Alle Leistungen</option>
          {SERVICES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select name="days" defaultValue={flat.days ?? ""} aria-label="Datum">
          {DATE_RANGES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </Select>
        <Select name="minCompleteness" defaultValue={filters.minCompleteness?.toString() ?? ""} aria-label="Vollständigkeit">
          <option value="">Jede Vollständigkeit</option>
          <option value="50">ab 50 %</option>
          <option value="80">ab 80 %</option>
          <option value="100">nur 100 %</option>
        </Select>
        <Select name="sort" defaultValue={filters.sort ?? "newest"} aria-label="Sortierung" className="sm:col-span-1">
          <option value="newest">Neueste zuerst</option>
          <option value="oldest">Älteste zuerst</option>
          <option value="completeness">Vollständigkeit</option>
          <option value="name">Name A–Z</option>
        </Select>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5 lg:justify-end">
          {hasFilters && (
            <Link href="/dashboard/cases" className={buttonStyles({ variant: "ghost" })}>
              Zurücksetzen
            </Link>
          )}
          <Button type="submit">Filtern</Button>
        </div>
      </form>

      <CaseTable cases={cases} emptyDescription={hasFilters ? "Keine Fälle passen zu den Filtern." : undefined} />
    </>
  );
}
