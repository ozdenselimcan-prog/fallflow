import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { KnowledgeEditor } from "@/components/dashboard/knowledge-editor";
import { PageHeader } from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Wissen & Preise" };

export default async function KnowledgePage() {
  const session = await requireSession();
  return (
    <>
      <Link href="/dashboard/assistant" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> KI-Assistent
      </Link>
      <PageHeader
        title="Wissen & Preise"
        description="Feste Preise und Antworten auf häufige Fragen – damit beantwortet die KI einfache Fragen Ihrer Kunden selbst, statt sie an Sie weiterzugeben."
      />
      <KnowledgeEditor canEdit={can(session.role, "assistant:manage")} />
    </>
  );
}
