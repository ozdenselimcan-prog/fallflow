import Link from "next/link";
import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import { buildingLabel } from "@/lib/cases/fields";
import type { CaseRecord } from "@/lib/data/types";
import type { CaseMeta } from "@/lib/intake/meta";
import { formatDate, timeAgo } from "@/lib/utils";
import { Completeness, ReadinessBadge, StatusBadge } from "./badges";

const SOURCE_LABELS: Record<CaseRecord["source"], string> = {
  widget: "Website",
  email: "E-Mail",
  whatsapp: "WhatsApp",
  phone: "Telefon",
  manual: "Manuell",
  demo: "Demo",
};

/** Zeigt die fehlenden Angaben zum Anklicken – ohne dass man erst den Fall öffnen muss. */
function MissingCell({ meta }: { meta?: CaseMeta }) {
  if (!meta || meta.missing.length === 0) return <span className="text-muted-foreground">–</span>;
  return (
    <details className="group relative [&::-webkit-details-marker]:hidden" onClick={(e) => e.stopPropagation()}>
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-warning hover:bg-warning-soft">
        <ListChecks className="size-3.5 shrink-0" aria-hidden />
        {meta.missing.length} {meta.missing.length === 1 ? "Angabe fehlt" : "Angaben fehlen"}
      </summary>
      <div className="absolute z-10 mt-1 w-56 rounded-xl border border-border bg-card p-3 text-xs shadow-lg">
        <ul className="space-y-1">
          {meta.missing.map((m) => (
            <li key={m} className="text-foreground">
              {m}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

/** Desktop: Tabelle, Mobile: Karten. */
export function CaseTable({ cases, meta = {}, emptyDescription }: { cases: CaseRecord[]; meta?: Record<string, CaseMeta>; emptyDescription?: string }) {
  if (cases.length === 0) {
    return <EmptyState title="Noch keine Beratungsfälle." description={emptyDescription ?? "Sobald eine neue Anfrage eingeht, erscheint sie hier."} />;
  }
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-background text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {["Kunde", "Anliegen", "Vollständigkeit", "Fehlt noch", "Status", "Quelle", "Aktivität"].map((h) => (
                <th key={h} scope="col" className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cases.map((c) => (
              <tr key={c.id} className="hover:bg-background/70">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/cases/${c.id}`} className="font-medium hover:text-accent hover:underline">
                    {c.customerName}
                  </Link>
                  <p className="text-xs text-muted-foreground">{buildingLabel(c.fields)}</p>
                </td>
                <td className="px-4 py-3">{c.service || "–"}</td>
                <td className="px-4 py-3">
                  <Completeness value={meta[c.id]?.percent ?? c.completeness} />
                  {meta[c.id] && (
                    <div className="mt-1">
                      <ReadinessBadge readiness={meta[c.id].readiness} />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <MissingCell meta={meta[c.id]} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{SOURCE_LABELS[c.source]}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{timeAgo(c.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {cases.map((c) => (
          <li key={c.id} className="rounded-2xl border border-border bg-card p-4">
            <Link href={`/dashboard/cases/${c.id}`} className="block">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{c.customerName}</p>
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {c.service || "–"} · {buildingLabel(c.fields)}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <Completeness value={meta[c.id]?.percent ?? c.completeness} />
                <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
              </div>
            </Link>
            {meta[c.id] && meta[c.id].missing.length > 0 && (
              <div className="mt-2 border-t border-border pt-2">
                <MissingCell meta={meta[c.id]} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
