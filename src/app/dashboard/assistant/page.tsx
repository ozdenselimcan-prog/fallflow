import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Building2, FileText, MessageCircle, MessageSquareText } from "lucide-react";
import { AssistantForm } from "@/components/dashboard/assistant-form";
import { AssistantPreview } from "@/components/dashboard/assistant-preview";
import { AutomationCard } from "@/components/dashboard/automation-card";
import { buttonStyles } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";

export const metadata: Metadata = { title: "KI-Assistent" };

export default async function AssistantPage() {
  const session = await requireSession();
  const store = await getStore(session);
  const assistant = await store.getAssistant();

  return (
    <>
      <PageHeader
        title="KI-Assistent"
        description="Legen Sie fest, wie der Assistent E-Mail-Anfragen bearbeitet und Fragen im Website-Chat beantwortet."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/assistant/profile" className={buttonStyles({ variant: "secondary" })}>
              <Building2 className="size-4" /> Ihr Betrieb
            </Link>
            <Link href="/dashboard/assistant/whatsapp" className={buttonStyles({ variant: "secondary" })}>
              <MessageCircle className="size-4" /> WhatsApp-Fragen
            </Link>
            <Link href="/dashboard/assistant/templates" className={buttonStyles({ variant: "secondary" })}>
              <FileText className="size-4" /> Vorlagen & Nachrichten
            </Link>
            <Link href="/dashboard/assistant/knowledge" className={buttonStyles({ variant: "secondary" })}>
              <BookOpen className="size-4" /> Wissen & Preise
            </Link>
            <Link href="/dashboard/assistant/texts" className={buttonStyles({ variant: "secondary" })}>
              <MessageSquareText className="size-4" /> Texte
            </Link>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <AssistantForm initial={assistant} canEdit={can(session.role, "assistant:manage")} />
        <div className="space-y-6">
          <AutomationCard canEdit={can(session.role, "assistant:manage")} />
          <AssistantPreview name={assistant.name} greeting={assistant.greeting} />
        </div>
      </div>
    </>
  );
}
