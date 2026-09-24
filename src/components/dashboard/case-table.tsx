import Link from "next/link";
import { Badge } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { buildingLabel, STATUS_LABELS } from "@/lib/cases/fields";
import type { CaseRecord, CaseStatus } from "@/lib/data/types";
import { cn, formatDate } from "@/lib/utils";

const statusTone: Record<CaseStatus, "accent" | "warning" | "success" | "neutral"> = {
  NEW: "accent",
  NEEDS_INFO: "warning",
  COMPLETE: "success",
  CONTACTED: "neutral",
  APPOINTMENT: "accent",
  CLOSED: "neutral",
};

export const StatusBadge = ({ status }: { status: CaseStatus }) => <Badge tone={statusTone[status]}>{STATUS_LABELS[status]}</Badge>;

export function Completeness({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", value >= 100 ? "bg-success" : "bg-accent")} style={{ width: `${value}%` }} />
      </div>
      <span className="text-sm tabular-nums">{value} %</span>
    </div>
  );
}

/** Desktop: Tabelle, Mobile: Karten. */
export function CaseTable({ cases, emptyDescription }: { cases: CaseRecord[]; emptyDescription?: string }) {
  if (cases.length === 0) {
    return <EmptyState title="Noch keine Beratungsfälle." description={emptyDescription ?? "Sobald eine neue Anfrage eingeht, erscheint sie hier."} />;
  }
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-background text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {["Kunde", "Anliegen", "Gebäude", "Vollständigkeit", "Status", "Datum"].map((h) => (
                <th key={h} scope="col" className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cases.map((c) => (
              <tr key={c.id} className="hover:bg-background/70">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/dashboard/cases/${c.id}`} className="hover:text-accent hover:underline">
                    {c.customerName}
                  </Link>
                </td>
                <td className="px-4 py-3">{c.service || "–"}</td>
                <td className="px-4 py-3 text-muted-foreground">{buildingLabel(c.fields)}</td>
                <td className="px-4 py-3">
                  <Completeness value={c.completeness} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {cases.map((c) => (
          <li key={c.id}>
            <Link href={`/dashboard/cases/${c.id}`} className="block rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{c.customerName}</p>
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {c.service || "–"} · {buildingLabel(c.fields)}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <Completeness value={c.completeness} />
                <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
