import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, FileWarning, MessageSquareMore } from "lucide-react";
import { Completeness, StatusBadge } from "@/components/dashboard/badges";
import { CaseTable } from "@/components/dashboard/case-table";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { DOCUMENT_LABELS, STATUS_HINTS, STATUS_LABELS } from "@/lib/cases/fields";
import { getStore } from "@/lib/data";
import { CASE_STATUSES, type CaseRecord, type CaseStatus } from "@/lib/data/types";
import { buildCaseMeta } from "@/lib/intake/meta";
import { cn, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "AI Intake" };

const FILTERS = { documents: "Warten auf Dokumente", followups: "Follow-up fällig" } as const;

function Panel({ title, description, empty, children, count }: { title: string; description: string; empty: string; children: React.ReactNode; count: number }) {
  return (
    <Card>
      <CardHeader title={title} description={description} action={<span className="text-2xl font-semibold tabular-nums">{count}</span>} />
      <div className="px-5 py-3">{count === 0 ? <p className="py-3 text-sm text-muted-foreground">{empty}</p> : <ul className="divide-y divide-border">{children}</ul>}</div>
    </Card>
  );
}

const CaseLink = ({ c }: { c: CaseRecord }) => (
  <Link href={`/dashboard/cases/${c.id}`} className="font-medium hover:text-accent hover:underline">
    {c.customerName}
  </Link>
);

/** AI Intake: alle laufenden Qualifizierungen – aktive Gespräche, neue Leads, fehlende Informationen, angeforderte Dokumente. */
export default async function IntakePage({ searchParams }: PageProps<"/dashboard/intake">) {
  const raw = await searchParams;
  const statusParam = typeof raw.status === "string" ? raw.status : "";
  const filterParam = typeof raw.filter === "string" ? raw.filter : "";
  const status = (CASE_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as CaseStatus) : null;
  const filter = filterParam in FILTERS ? (filterParam as keyof typeof FILTERS) : null;

  const session = await requireSession();
  const store = await getStore(session);
  const [cases, documents, followUps, questions] = await Promise.all([store.listCases({ sort: "newest" }), store.listDocuments(), store.listFollowUps(), store.listQuestions()]);
  const meta = buildCaseMeta(cases, questions, documents);
  const nameOf = new Map(cases.map((c) => [c.id, c]));

  const counts = Object.fromEntries(CASE_STATUSES.map((s) => [s, cases.filter((c) => c.status === s).length])) as Record<CaseStatus, number>;
  const byActivity = (list: CaseRecord[]) => [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const openDocCases = new Set(documents.filter((d) => d.status === "requested" && nameOf.get(d.caseId)?.status !== "CONVERTED").map((d) => d.caseId));
  const manualCases = new Set(followUps.filter((f) => f.status === "manual").map((f) => f.caseId));

  let filtered: CaseRecord[] | null = null;
  if (status) filtered = cases.filter((c) => c.status === status);
  else if (filter === "documents") filtered = cases.filter((c) => openDocCases.has(c.id));
  else if (filter === "followups") filtered = cases.filter((c) => manualCases.has(c.id));

  const fresh = byActivity(cases.filter((c) => c.status === "NEW"));
  const qualifying = byActivity(cases.filter((c) => c.status === "QUALIFYING"));
  const missing = byActivity(cases.filter((c) => c.status === "WAITING_FOR_CUSTOMER" || (c.status === "QUALIFYING" && (meta[c.id]?.missing.length ?? 0) > 0)));
  const requestedDocs = documents.filter((d) => d.status === "requested" && nameOf.get(d.caseId) && nameOf.get(d.caseId)!.status !== "CONVERTED");
  const finished = byActivity(cases.filter((c) => ["COMPLETE", "READY_FOR_REVIEW", "CONVERTED"].includes(c.status)));
  const testUrl = `/widget/${session.companyId}`;

  return (
    <>
      <LiveRefresh active={counts.NEW + counts.QUALIFYING > 0} everyMs={6000} />
      <PageHeader
        title="AI Intake"
        description="Hier qualifiziert die KI Anfragen: Sie erkennt Angaben, fragt Fehlendes nach, fordert Dokumente an und bereitet den Fall vor."
        action={
          <a href={testUrl} target="_blank" rel="noreferrer" className={buttonStyles({ variant: "secondary" })}>
            <ExternalLink className="size-4" /> Website-Chat testen
          </a>
        }
      />

      <nav aria-label="Status" className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {CASE_STATUSES.map((s) => (
          <Link
            key={s}
            href={status === s ? "/dashboard/intake" : `/dashboard/intake?status=${s}`}
            aria-current={status === s ? "true" : undefined}
            title={STATUS_HINTS[s]}
            className={cn("rounded-xl border bg-card px-3 py-2.5 transition-colors hover:border-accent/50", status === s ? "border-accent ring-1 ring-accent" : "border-border")}
          >
            <p className="text-2xl font-semibold tabular-nums">{counts[s]}</p>
            <p className="text-xs text-muted-foreground">{STATUS_LABELS[s]}</p>
          </Link>
        ))}
      </nav>

      {filtered ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{status ? STATUS_LABELS[status] : FILTERS[filter!]}</h2>
            <Link href="/dashboard/intake" className="text-sm font-medium text-accent hover:underline">
              Filter zurücksetzen
            </Link>
          </div>
          <CaseTable cases={byActivity(filtered)} meta={meta} emptyDescription="Keine Vorgänge in dieser Ansicht." />
        </section>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Neu erkannte Leads" description="Eingegangen, noch nicht ausgewertet" count={fresh.length} empty="Keine neuen Leads.">
              {fresh.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <CaseLink c={c} />
                    <p className="truncate text-xs text-muted-foreground">{c.fields.description || c.service || "–"}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                </li>
              ))}
            </Panel>

            <Panel title="Aktive Gespräche" description="Die KI sammelt gerade Informationen" count={qualifying.length} empty="Aktuell läuft kein Gespräch.">
              {qualifying.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <CaseLink c={c} />
                    <p className="text-xs text-muted-foreground">aktiv {timeAgo(c.updatedAt)}</p>
                  </div>
                  <Completeness value={meta[c.id]?.percent ?? c.completeness} />
                </li>
              ))}
            </Panel>

            <Panel title="Fehlende Informationen" description="Was noch vom Kunden kommen muss" count={missing.length} empty="Nichts fehlt – alle Vorgänge sind vollständig.">
              {missing.slice(0, 5).map((c) => (
                <li key={c.id} className="py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <CaseLink c={c} />
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="mt-0.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MessageSquareMore className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {meta[c.id]?.missing.join(", ") || "–"}
                  </p>
                </li>
              ))}
            </Panel>

            <Panel title="Automatisch angeforderte Dokumente" description="Vom Kunden noch nicht hochgeladen" count={requestedDocs.length} empty="Keine offenen Dokumentenanforderungen.">
              {requestedDocs.slice(0, 5).map((d) => {
                const c = nameOf.get(d.caseId)!;
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <CaseLink c={c} />
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FileWarning className="size-3.5" aria-hidden /> {DOCUMENT_LABELS[d.kind]} angefordert {timeAgo(d.requestedAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </Panel>
          </div>

          <Panel title="Abgeschlossene Qualifizierungen" description="Fallakte vorbereitet – bereit für den Berater" count={finished.length} empty="Noch keine abgeschlossenen Qualifizierungen.">
            {finished.slice(0, 6).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <CaseLink c={c} />
                  <p className="text-xs text-muted-foreground">
                    {c.service || "–"} · {timeAgo(c.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Completeness value={meta[c.id]?.percent ?? c.completeness} />
                  <StatusBadge status={c.status} />
                </div>
              </li>
            ))}
          </Panel>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Alle Vorgänge</h2>
            <CaseTable cases={byActivity(cases)} meta={meta} />
          </section>
        </div>
      )}
    </>
  );
}
