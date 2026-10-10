import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppointmentConfirmationCard } from "@/components/dashboard/appointment-confirmation-card";
import { ServiceMessagesPanel } from "@/components/dashboard/service-messages-panel";
import { PageHeader } from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";

export const metadata: Metadata = { title: "Vorlagen & Nachrichten" };

export default async function AssistantTemplatesPage() {
  const session = await requireSession();
  const store = await getStore(session);
  const [company, documentTemplates, serviceMessages, assistant] = await Promise.all([
    store.getCompany(),
    store.listDocumentTemplates(),
    store.listServiceMessages(),
    store.getAssistant(),
  ]);
  const canEdit = can(session.role, "company:manage");

  return (
    <>
      <Link href="/dashboard/assistant" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> KI-Assistent
      </Link>
      <PageHeader title="Vorlagen & Nachrichten" description="Pro Leistung: PDF-Vorlagen anhängen und den Nachrichtentext festlegen, den der Assistent dazu verschickt." />
      <AppointmentConfirmationCard initial={assistant} canEdit={can(session.role, "assistant:manage")} />
      <div className="h-4" />
      <ServiceMessagesPanel
        services={company.services}
        initialMessages={serviceMessages.map((m) => ({
          service: m.service,
          body: m.body,
          appointmentNote: m.appointmentNote,
          requiresFloorplan: m.requiresFloorplan,
          requiresEnergyCertificate: m.requiresEnergyCertificate,
          subject: m.subject,
        }))}
        initialTemplates={documentTemplates.map((t) => ({ id: t.id, service: t.service, title: t.title, fileName: t.fileName, alwaysInclude: t.alwaysInclude }))}
        canEdit={canEdit}
      />
    </>
  );
}
