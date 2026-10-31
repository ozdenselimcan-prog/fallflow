import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CustomerTextsEditor } from "@/components/dashboard/customer-texts-editor";
import { PageHeader } from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Texte" };

export default async function CustomerTextsPage() {
  const session = await requireSession();
  return (
    <>
      <Link href="/dashboard/assistant" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> KI-Assistent
      </Link>
      <PageHeader
        title="Texte"
        description="Alle Sätze, die FallFlow automatisch an Ihre Kunden schickt – per E-Mail, WhatsApp und im Website-Chat. Jeder lässt sich ändern oder abschalten."
      />
      <CustomerTextsEditor canEdit={can(session.role, "assistant:manage")} />
    </>
  );
}
