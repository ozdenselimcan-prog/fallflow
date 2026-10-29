import type { Metadata } from "next";
import { AiPauseNotice } from "@/components/dashboard/ai-pause-notice";
import { AI_PAUSED_KEY } from "@/lib/intake/engine";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Eye } from "lucide-react";
import { ReadinessBadge, StatusBadge } from "@/components/dashboard/badges";
import { CaseActions } from "@/components/dashboard/case-actions";
import { CaseEditor } from "@/components/dashboard/case-editor";
import { AiStatusCard, CompletenessCard, PreparedCard, SummaryCard } from "@/components/dashboard/case-file";
import { CommunicationPanel } from "@/components/dashboard/communication";
import { DocumentsPanel } from "@/components/dashboard/documents-panel";
import { KiToolsCard } from "@/components/dashboard/ki-tools-card";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { hasAiTools } from "@/lib/billing/limits";
import { FIELD_GROUPS } from "@/lib/cases/fields";
import { CORE_FIELD_KEYS } from "@/lib/ai/business-profile";
import { templateQuestionLabels } from "@/lib/intake/template-questions";
import { FORM_ENTRIES_KEY, parseFormEntries } from "@/lib/cases/form-entries";
import { attentionOf } from "@/lib/cases/attention";
import { getStore } from "@/lib/data";
import { publicDocument } from "@/lib/documents/public";
import { currentUploadLink, SKIPPED_ATTACHMENTS_KEY } from "@/lib/intake/case-ops";
import { buildChecklist, documentRequirements, readinessOf } from "@/lib/intake/checklist";
import { formatDateTime, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Fallakte" };

const KNOWN_KEYS = new Set([...FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key)), "appointmentWish"]);
const SOURCE_LABELS = { widget: "Website-Chat", email: "E-Mail", phone: "Telefon", whatsapp: "WhatsApp", manual: "Manuell angelegt", demo: "Demo" } as const;

export default async function CaseDetailPage({ params }: PageProps<"/dashboard/cases/[id]">) {
  const { id } = await params;
  const session = await requireSession();
  const store = await getStore(session);
  // Keine dieser Abfragen hängt vom Ergebnis der anderen ab, alle brauchen nur die id – parallel statt
  // nacheinander (spart eine Datenbank-Runde beim Öffnen einer Fallakte).
  const [c, events, messages, documents, questions, company, templateDocs, templates, subscription, serviceMessages] = await Promise.all([
    store.getCase(id).catch(() => null),
    store.listEvents(id),
    store.listMessages(id),
    store.listDocuments(id),
    store.listQuestions(),
    store.getCompany(),
    store.listTemplateDocuments(id),
    store.listDocumentTemplates(),
    store.getSubscription(),
    store.listServiceMessages(),
  ]);
  if (!c) notFound();
  const canWrite = can(session.role, "cases:write");
  const foerderOverrides = { energyCertificate: company.foerderEnergyCertificate, floorplan: company.foerderFloorplan, profiled: Boolean(company.businessProfile?.industry) };
  const templateTitleById = new Map(templates.map((t) => [t.id, t.title]));
  const templateSends = templateDocs.map((td) => ({ id: td.id, title: templateTitleById.get(td.templateId) ?? "Vorlage", status: td.status, filled: td.filled }));
  const profiled = foerderOverrides.profiled;
  const checklist = buildChecklist({ questions, fields: c.fields, documents, foerderOverrides, serviceMessages, templateSends, includeFields: c.source !== "email" || profiled });
  const readiness = readinessOf(c.status, checklist);
  // Betrieb mit Betriebsprofil: Kunde, die branchenspezifischen Angaben aus dem Profil und das Anliegen –
  // keine Energieberatungs-Gruppen (Gebäude, Heizung, Eigentümerstatus).
  const core: readonly string[] = CORE_FIELD_KEYS;
  // WhatsApp-Fragen nur zeigen, wenn beantwortet (bei anderen Kanälen werden sie nie gestellt).
  const profileFields = questions.filter((q) => !core.includes(q.key) && (!q.whatsappOnly || c.fields[q.key])).map((q) => ({ key: q.key, label: q.label }));
  const formFields = templateQuestionLabels(company.businessProfile.templateQuestions).filter((f) => c.fields[f.key]);
  const customGroups = profiled
    ? [
        { title: "Kunde", fields: [{ key: "name", label: "Name" }, { key: "email", label: "E-Mail" }, { key: "phone", label: "Telefon" }, { key: "street", label: "Straße, Nr." }, { key: "postalCode", label: "PLZ" }, { key: "city", label: "Ort" }] },
        ...(profileFields.length ? [{ title: "Angaben zum Auftrag", fields: profileFields }] : []),
        // Im Chat (WhatsApp/Telefon) einzeln erfragte Angaben aus den PDF-Formularen – nur die beantworteten.
        ...(formFields.length ? [{ title: "Angaben aus Formularen", fields: formFields }] : []),
        { title: "Anliegen", fields: [{ key: "service", label: "Gewünschte Leistung" }, { key: "description", label: "Beschreibung" }, { key: "priority", label: "Priorität" }] },
      ]
    : undefined;
  const extra = profiled ? [] : questions.filter((q) => !KNOWN_KEYS.has(q.key)).map((q) => ({ key: q.key, label: q.label }));
  const requiredKeys = questions.filter((q) => q.active && q.required).map((q) => q.key);
  const formEntries = parseFormEntries(c.fields[FORM_ENTRIES_KEY]);
  const skippedFiles = (c.fields[SKIPPED_ATTACHMENTS_KEY] ?? "").split("\n").filter(Boolean);
  const showPrepared = c.status === "COMPLETE" || c.status === "READY_FOR_REVIEW" || c.status === "CONVERTED";
  // Vorlagen, die der Kunde ausgefüllt zurückschicken soll – mit allen Dateien, die er dazu geschickt hat (auch frühere Versionen).
  const returnForms = templateDocs
    .filter((td) => td.status !== "info")
    .map((td) => {
      const title = templateTitleById.get(td.templateId) ?? "Vorlage";
      const files = documents.filter((d) => d.status === "received" && (d.storagePath === td.storagePath || d.fileName.startsWith(`${title} (vom Kunden)`)));
      return { td, title, files: [...new Map(files.map((f) => [f.id, f])).values()] };
    });

  return (
    <div className="space-y-6">
      <LiveRefresh active={c.status === "NEW" || c.status === "QUALIFYING"} />
      <Link href="/dashboard/cases" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Alle Fälle
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{c.customerName && c.customerName !== "Unbekannt" ? c.customerName : (c.fields.email ?? c.customerName)}</h1>
          <StatusBadge status={c.status} />
          <ReadinessBadge readiness={readiness} />
        </div>
        <p className="text-sm text-muted-foreground">
          Anfrage · {SOURCE_LABELS[c.source]} · eingegangen am {formatDateTime(c.createdAt)} · zuletzt aktiv {timeAgo(c.updatedAt)}
        </p>
        <CaseActions caseId={c.id} customerName={c.customerName} email={c.fields.email ?? ""} status={c.status} canWrite={canWrite} />
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <aside className="space-y-4 lg:order-2">
          {attentionOf(c.fields) && (
            <Notice>
              <span className="font-medium">Aufmerksamkeit benötigt: </span>
              {attentionOf(c.fields)}. Die KI hat nicht automatisch geantwortet – bitte antworten Sie dem Kunden selbst. Danach im{" "}
              <Link href="/dashboard/inbox" className="font-medium underline">
                Posteingang
              </Link>{" "}
              auf „Erledigt“ klicken (passiert automatisch, wenn Sie aus FallFlow antworten).
            </Notice>
          )}
          <CompletenessCard checklist={checklist} readiness={readiness} />
          {showPrepared && <PreparedCard checklist={checklist} fields={c.fields} summary={c.summary} />}
          <Card>
            <CardHeader title="Verlauf & KI-Aktivitäten" />
            <ol className="space-y-4 px-5 py-4">
              {events.length === 0 && <li className="text-sm text-muted-foreground">Noch keine Ereignisse.</li>}
              {events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                  <div>
                    <p className="text-sm font-medium">{e.type === "assessment" ? "KI-Voreinschätzung erstellt (siehe unten)" : e.text}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </aside>

        <div className="space-y-6 lg:order-1 lg:col-span-2">
          {c.fields[AI_PAUSED_KEY] === "1" && <AiPauseNotice caseId={c.id} canWrite={canWrite} />}
          <AiStatusCard checklist={checklist} status={c.status} />
          <SummaryCard summary={c.summary} />
          {returnForms.length > 0 && (
            <Card>
              <CardHeader title="Ausgefüllte Formulare vom Kunden" description="Die PDF-Vorlagen, die der Kunde ausgefüllt zurückschicken soll – zum Ansehen und Herunterladen." />
              <ul className="divide-y divide-border px-5">
                {returnForms.map(({ td, title, files }) => (
                  <li key={td.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{title}</p>
                      {td.status === "sent" ? (
                        <Badge>Noch nicht zurück</Badge>
                      ) : td.filled === false ? (
                        <Badge tone="warning">Zurück, aber unvollständig</Badge>
                      ) : (
                        <Badge tone="success">Ausgefüllt zurück</Badge>
                      )}
                    </div>
                    {td.status === "received" && td.aiNote && <p className="mt-1 text-xs text-muted-foreground">KI-Prüfung: {td.aiNote}</p>}
                    {files.map((f) => (
                      <div key={f.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate text-muted-foreground">
                          {f.fileName.replace(`${title} (vom Kunden) – `, "")}
                          {f.receivedAt ? ` · ${formatDateTime(f.receivedAt)}` : ""}
                        </span>
                        <span className="flex gap-3">
                          <a href={`/api/documents/${f.id}?view=1`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                            <Eye className="size-3.5" aria-hidden /> Ansehen
                          </a>
                          <a href={`/api/documents/${f.id}`} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                            <Download className="size-3.5" aria-hidden /> Herunterladen
                          </a>
                        </span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <CaseEditor caseId={c.id} fields={c.fields} canWrite={canWrite} extra={extra} requiredKeys={requiredKeys} customGroups={customGroups} serviceOptions={profiled ? [...company.services.filter((s) => s !== "Sonstiges"), "Sonstiges"] : undefined} />
          {formEntries.length > 0 && (
            <Card>
              <CardHeader title="Weitere Angaben aus ausgefüllten Formularen" description="Vom Kunden in die zurückgeschickten PDF-Vorlagen eingetragen." />
              <dl className="divide-y divide-border px-5 text-sm">
                {formEntries.map((e) => (
                  <div key={e.label} className="flex justify-between gap-4 py-2">
                    <dt className="text-muted-foreground">{e.label}</dt>
                    <dd className="text-right font-medium">{e.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
          {skippedFiles.length > 0 && (
            <Notice>
              <span className="font-medium">Kunde hat Bilder bzw. Dateien geschickt, die hier nicht angezeigt werden können</span> ({skippedFiles.join(", ")}). Bitte
              schauen Sie selbstständig in Ihren E-Mails nach.
            </Notice>
          )}
          <DocumentsPanel
            caseId={c.id}
            documents={documents.map(publicDocument)}
            requirements={documentRequirements(c.fields, foerderOverrides).map((r) => ({ kind: r.kind, required: r.required }))}
            customerName={c.customerName}
            email={c.fields.email ?? ""}
            uploadLink={currentUploadLink(c)}
            canWrite={canWrite}
          />
          {!profiled && <KiToolsCard caseId={c.id} events={events} yearBuilt={c.fields.yearBuilt} hasEmail={Boolean(c.fields.email)} canWrite={canWrite} locked={!hasAiTools(subscription.plan)} />}
          <CommunicationPanel caseId={c.id} messages={messages} canWrite={canWrite} hasEmail={Boolean(c.fields.email) || (c.source === "whatsapp" && Boolean(c.fields.phone))} />
        </div>
      </div>
    </div>
  );
}
