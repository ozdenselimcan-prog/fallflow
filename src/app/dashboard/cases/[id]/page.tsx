import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { CaseActions } from "@/components/dashboard/case-actions";
import { CaseEditor } from "@/components/dashboard/case-editor";
import { Completeness, StatusBadge } from "@/components/dashboard/case-table";
import { Card, CardHeader } from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { FIELD_GROUPS } from "@/lib/cases/fields";
import { getStore } from "@/lib/data";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Beratungsfall" };

const KNOWN_KEYS = new Set([...FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key)), "appointmentWish"]);

export default async function CaseDetailPage({ params }: PageProps<"/dashboard/cases/[id]">) {
  const { id } = await params;
  const session = await requireSession();
  const store = await getStore(session);
  const c = await store.getCase(id).catch(() => null);
  if (!c) notFound();

  const [events, messages, questions] = await Promise.all([store.listEvents(id), store.listMessages(id), store.listQuestions()]);
  const extra = questions.filter((q) => !KNOWN_KEYS.has(q.key)).map((q) => ({ key: q.key, label: q.label }));

  return (
    <div className="space-y-6">
      <Link href="/dashboard/cases" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Alle Fälle
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{c.customerName}</h1>
          <StatusBadge status={c.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span>Eingegangen am {formatDateTime(c.createdAt)}</span>
          <span className="flex items-center gap-2">
            Vollständigkeit <Completeness value={c.completeness} />
          </span>
        </div>
        <CaseActions caseId={c.id} customerName={c.customerName} email={c.fields.email ?? ""} status={c.status} canWrite={can(session.role, "cases:write")} />
      </header>

      <Card className="border-accent/30 bg-accent-soft/50">
        <div className="flex gap-3 p-5">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" />
          <div>
            <h2 className="text-sm font-semibold">KI-Zusammenfassung</h2>
            <p className="mt-1 text-sm leading-relaxed">{c.summary || "Noch keine Zusammenfassung."}</p>
            <p className="mt-2 text-xs text-muted-foreground">Automatisch aus den erfassten Angaben erstellt – bitte fachlich prüfen.</p>
          </div>
        </div>
      </Card>

      <CaseEditor caseId={c.id} fields={c.fields} canWrite={can(session.role, "cases:write")} extra={extra} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Verlauf" />
          <ol className="space-y-4 px-5 py-4">
            {events.length === 0 && <li className="text-sm text-muted-foreground">Noch keine Ereignisse.</li>}
            {events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                <div>
                  <p className="text-sm font-medium">{e.text}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
        <Card>
          <CardHeader title="Gesprächsverlauf" />
          <div className="max-h-96 space-y-2 overflow-y-auto px-5 py-4">
            {messages.length === 0 && <p className="text-sm text-muted-foreground">Keine Nachrichten gespeichert.</p>}
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
                <span className={`inline-block max-w-[90%] rounded-2xl px-3 py-2 text-left text-sm ${m.role === "user" ? "bg-accent text-white" : "bg-muted"}`}>{m.content}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
