import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ReadinessBadge, StatusBadge } from "@/components/dashboard/badges";
import { CaseActions } from "@/components/dashboard/case-actions";
import { CaseEditor } from "@/components/dashboard/case-editor";
import { AiStatusCard, CompletenessCard, PreparedCard, SummaryCard } from "@/components/dashboard/case-file";
import { CommunicationPanel } from "@/components/dashboard/communication";
import { DocumentsPanel } from "@/components/dashboard/documents-panel";
import { FollowUpsPanel } from "@/components/dashboard/followups-panel";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
import { Card, CardHeader } from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { FIELD_GROUPS } from "@/lib/cases/fields";
import { getStore } from "@/lib/data";
import { publicDocument } from "@/lib/documents/public";
import { currentUploadLink } from "@/lib/intake/case-ops";
import { buildChecklist, documentRequirements, readinessOf } from "@/lib/intake/checklist";
import { formatDateTime, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Fallakte" };

const KNOWN_KEYS = new Set([...FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key)), "appointmentWish"]);
const SOURCE_LABELS = { widget: "Website-Chat", email: "E-Mail", whatsapp: "WhatsApp", phone: "Telefon", manual: "Manuell angelegt", demo: "Demo" } as const;

export default async function CaseDetailPage({ params }: PageProps<"/dashboard/cases/[id]">) {
  const { id } = await params;
  const session = await requireSession();
  const store = await getStore(session);
  const c = await store.getCase(id).catch(() => null);
  if (!c) notFound();

  const [events, messages, documents, followUps, questions] = await Promise.all([
    store.listEvents(id),
    store.listMessages(id),
    store.listDocuments(id),
    store.listFollowUps(id),
    store.listQuestions(),
  ]);
  const canWrite = can(session.role, "cases:write");
  const checklist = buildChecklist({ questions, fields: c.fields, documents });
  const readiness = readinessOf(c.status, checklist);
  const extra = questions.filter((q) => !KNOWN_KEYS.has(q.key)).map((q) => ({ key: q.key, label: q.label }));
  const requiredKeys = questions.filter((q) => q.active && q.required).map((q) => q.key);
  const canPlan = Boolean(c.fields.email || c.fields.phone) && checklist.missing.length > 0 && c.status !== "CONVERTED";
  const showPrepared = c.status === "COMPLETE" || c.status === "READY_FOR_REVIEW" || c.status === "CONVERTED";

  return (
    <div className="space-y-6">
      <LiveRefresh active={c.status === "NEW" || c.status === "QUALIFYING"} />
      <Link href="/dashboard/cases" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Alle Fälle
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{c.customerName}</h1>
          <StatusBadge status={c.status} />
          <ReadinessBadge readiness={readiness} />
        </div>
        <p className="text-sm text-muted-foreground">
          Beratungsfall · {SOURCE_LABELS[c.source]} · eingegangen am {formatDateTime(c.createdAt)} · zuletzt aktiv {timeAgo(c.updatedAt)}
        </p>
        <CaseActions caseId={c.id} customerName={c.customerName} email={c.fields.email ?? ""} status={c.status} canWrite={canWrite} />
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <aside className="space-y-4 lg:order-2">
          <CompletenessCard checklist={checklist} readiness={readiness} />
          {showPrepared && <PreparedCard checklist={checklist} fields={c.fields} summary={c.summary} />}
          <FollowUpsPanel caseId={c.id} followUps={followUps} canWrite={canWrite} canPlan={canPlan} />
          <Card>
            <CardHeader title="Verlauf & KI-Aktivitäten" />
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
        </aside>

        <div className="space-y-6 lg:order-1 lg:col-span-2">
          <AiStatusCard checklist={checklist} status={c.status} />
          <SummaryCard summary={c.summary} />
          <CaseEditor caseId={c.id} fields={c.fields} canWrite={canWrite} extra={extra} requiredKeys={requiredKeys} />
          <DocumentsPanel
            caseId={c.id}
            documents={documents.map(publicDocument)}
            requirements={documentRequirements(c.fields).map((r) => ({ kind: r.kind, required: r.required }))}
            customerName={c.customerName}
            email={c.fields.email ?? ""}
            uploadLink={currentUploadLink(c)}
            canWrite={canWrite}
          />
          <CommunicationPanel caseId={c.id} messages={messages} canWrite={canWrite} hasEmail={Boolean(c.fields.email)} hasPhone={Boolean(c.fields.phone)} />
        </div>
      </div>
    </div>
  );
}
