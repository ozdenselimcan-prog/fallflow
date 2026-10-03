import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
      <PageHeader title="Vorlagen & Nachrichten" description="Pro Leistung: PDF-Vorlagen anhängen und den Nachrichtentext festlegen, den der Assistent dazu verschickt." />
      <ServiceMessagesPanel
        services={company.services}
        initialMessages={serviceMessages.map((m) => ({ service: m.service, body: m.body }))}
        initialTemplates={documentTemplates.map((t) => ({ id: t.id, service: t.service, title: t.title, fileName: t.fileName, alwaysInclude: t.alwaysInclude }))}
        canEdit={canEdit}
      />
    </>
  );
}
