import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { WhatsAppQuestionsEditor } from "@/components/dashboard/whatsapp-questions-editor";
import { PageHeader } from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "WhatsApp-Fragen" };

export default async function WhatsAppQuestionsPage() {
  const session = await requireSession();
  return (
    <>
      <Link href="/dashboard/assistant" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> KI-Assistent
      </Link>
      <PageHeader
        title="WhatsApp-Fragen"
        description="Genau diese Fragen stellt der Assistent im WhatsApp-Chat – eine nach der anderen, in dieser Reihenfolge. Name und Handynummer kennt WhatsApp schon. Am Ende bittet er um die Fotos aus „Ihr Betrieb“."
      />
      <WhatsAppQuestionsEditor canEdit={can(session.role, "assistant:manage")} />
    </>
  );
}
