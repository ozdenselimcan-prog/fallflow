import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CleanupTestAccountsButton } from "@/components/admin/cleanup-button";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
import { Badge, Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { isPlatformAdmin, loadCompanyOverview, mailHealth, type CompanyRow } from "@/lib/admin/overview";
import { aiHealth } from "@/lib/ai/provider";
import { requireSession } from "@/lib/auth/session";
import { getPlan } from "@/lib/config/pricing";
import { formatDateTime, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Betreiber-Übersicht", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { trialing: "Testphase", active: "Aktiv", past_due: "Zahlung offen", canceled: "Beendet" };

function aboBadge(c: CompanyRow) {
  if (c.needsPayment) return <Badge tone="warning">Keine Zahlungsmethode</Badge>;
  const tone = c.status === "active" ? "success" : c.status === "trialing" ? "accent" : c.status === "past_due" ? "warning" : "neutral";
  return <Badge tone={tone}>{STATUS_LABEL[c.status] ?? c.status}</Badge>;
}

function mailboxCell(c: CompanyRow) {
  if (!c.mailbox) return <span className="text-muted-foreground">nicht verbunden</span>;
  const m = c.mailbox;
  return (
    <div>
      <p className="truncate">{m.account}</p>
      <p className="text-xs text-muted-foreground">
        {m.provider === "microsoft" ? "Microsoft" : "IMAP"} ·{" "}
        {m.status === "error" ? <span className="text-danger">Fehler</span> : m.stale ? <span className="text-warning">hängt</span> : <span className="text-success">ok</span>}
        {m.lastSyncedAt ? ` · ${timeAgo(m.lastSyncedAt)}` : " · noch nie abgerufen"}
      </p>
      {m.lastError && <p className="max-w-56 truncate text-xs text-danger" title={m.lastError}>{m.lastError}</p>}
    </div>
  );
}

/** Nur für die Betreiber von FallFlow (ADMIN_EMAILS): alle Büros, Abos, Postfächer und Aktivität auf einen Blick. */
export default async function AdminPage() {
  const session = await requireSession();
  if (!isPlatformAdmin(session.email)) notFound();
  const [rows, health, ai] = await Promise.all([loadCompanyOverview(), mailHealth(), aiHealth()]);

  const paying = rows.filter((r) => r.status === "active");
  const trial = rows.filter((r) => r.status === "trialing" && r.hasPayment);
  const mrr = paying.reduce((sum, r) => sum + getPlan(r.plan).priceEur, 0);
  const cards = [
    { label: "Büros gesamt", value: rows.length },
    { label: "Zahlend", value: paying.length, hint: `${mrr} €/Monat` },
    { label: "In der Testphase", value: trial.length },
    { label: "Ohne Zahlungsmethode", value: rows.filter((r) => r.needsPayment).length },
    { label: "Anfragen (30 Tage)", value: rows.reduce((s, r) => s + r.cases30d, 0) },
    { label: "Postfächer mit Problem", value: (health?.errors ?? 0) + (health?.stale ?? 0), warn: !health?.ok },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
      <LiveRefresh active everyMs={60000} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo href="/dashboard" />
          <h1 className="text-xl font-semibold">Betreiber-Übersicht</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={ai === "ok" ? "success" : "danger"}>
            KI: {ai === "ok" ? "läuft" : ai === "no_credits" ? "OpenAI-Guthaben aufgebraucht!" : ai === "not_configured" ? "nicht eingerichtet" : "Fehler"}
          </Badge>
          <Badge tone={health?.ok === false ? "danger" : "success"}>
            Mail-Abruf: {health ? (health.ok ? "läuft" : `${health.errors} Fehler, ${health.stale} hängen`) : "–"}
          </Badge>
        </div>
      </div>

      <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <li key={c.label}>
            <Card className={c.warn ? "border-danger/40 p-4" : "p-4"}>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</p>
              {c.hint && <p className="text-xs text-muted-foreground">{c.hint}</p>}
            </Card>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <CleanupTestAccountsButton count={rows.filter((r) => /^claude-[^@]+@mailinator\.com$/i.test(r.owner)).length} />
      </div>

      <Card className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Büro</th>
              <th className="px-4 py-3 font-medium">Abo</th>
              <th className="px-4 py-3 font-medium">Postfach</th>
              <th className="px-4 py-3 font-medium">Anfragen</th>
              <th className="px-4 py-3 font-medium">Zuletzt aktiv</th>
              <th className="px-4 py-3 font-medium">Angelegt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((c) => (
              <tr key={c.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.owner || "–"}</p>
                  {!c.onboarded && <p className="text-xs text-warning">Onboarding nicht abgeschlossen</p>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    {aboBadge(c)}
                    <span className="text-xs text-muted-foreground">
                      {getPlan(c.plan).name}
                      {c.periodEnd ? ` · bis ${formatDateTime(c.periodEnd)}` : ""}
                    </span>
                    {c.canceledAt && <span className="text-xs text-danger">Löschung am {formatDateTime(new Date(Date.parse(c.canceledAt) + 30 * 86_400_000).toISOString())}</span>}
                  </div>
                </td>
                <td className="max-w-64 px-4 py-3">{mailboxCell(c)}</td>
                <td className="px-4 py-3 tabular-nums">
                  {c.cases30d} <span className="text-xs text-muted-foreground">/ 30 Tage · {c.casesTotal} gesamt</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.lastActivity ? timeAgo(c.lastActivity) : "–"}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDateTime(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">Aktualisiert sich jede Minute. „Hängt“ = seit über 3 Stunden kein erfolgreicher Abruf.</p>
    </main>
  );
}
