import Link from "next/link";
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

const missingText = (m?: CaseMeta) => (!m || m.missing.length === 0 ? "–" : m.missing.length <= 2 ? m.missing.join(", ") : `${m.missing.slice(0, 2).join(", ")} +${m.missing.length - 2}`);

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
                <td className="max-w-48 px-4 py-3 text-muted-foreground">{missingText(meta[c.id])}</td>
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
          <li key={c.id}>
            <Link href={`/dashboard/cases/${c.id}`} className="block rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{c.customerName}</p>
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {c.service || "–"} · {buildingLabel(c.fields)}
              </p>
              {meta[c.id] && meta[c.id].missing.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Fehlt: {missingText(meta[c.id])}</p>}
              <div className="mt-3 flex items-center justify-between">
                <Completeness value={meta[c.id]?.percent ?? c.completeness} />
                <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
