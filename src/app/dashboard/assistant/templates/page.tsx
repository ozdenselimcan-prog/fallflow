import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DocumentTemplatesPanel } from "@/components/dashboard/document-templates-panel";
import { ServiceMessagesPanel } from "@/components/dashboard/service-messages-panel";
import { PageHeader } from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";

export const metadata: Metadata = { title: "Vorlagen & Nachrichten" };

export default async function AssistantTemplatesPage() {
  const session = await requireSession();
  const store = await getStore(session);
  const [company, documentTemplates, serviceMessages] = await Promise.all([store.getCompany(), store.listDocumentTemplates(), store.listServiceMessages()]);
  const canEdit = can(session.role, "company:manage");

  return (
    <>
      <Link href="/dashboard/assistant" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> KI-Assistent
      </Link>
      <PageHeader title="Vorlagen & Nachrichten" description="PDF-Vorlagen je Leistung und die Nachrichtentexte, die der Assistent zusammen mit ihnen an den Kunden schickt." />
      <div className="space-y-6">
        <DocumentTemplatesPanel initial={documentTemplates.map((t) => ({ id: t.id, service: t.service, title: t.title, fileName: t.fileName, alwaysInclude: t.alwaysInclude }))} canEdit={canEdit} />
        <div>
          <h2 className="mb-3 font-semibold">Nachrichtentexte je Leistung</h2>
          <ServiceMessagesPanel
            services={company.services}
            initialMessages={serviceMessages.map((m) => ({ service: m.service, body: m.body }))}
            initialTemplates={documentTemplates.map((t) => ({ id: t.id, service: t.service, title: t.title, fileName: t.fileName }))}
            canEdit={canEdit}
          />
        </div>
      </div>
    </>
  );
}
