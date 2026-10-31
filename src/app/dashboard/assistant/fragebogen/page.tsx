import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SetupQuestionnaire } from "@/components/dashboard/setup-questionnaire";
import { PageHeader } from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Fragebogen" };

export default async function QuestionnairePage() {
  const session = await requireSession();
  return (
    <>
      <Link href="/dashboard/assistant" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> KI-Assistent
      </Link>
      <PageHeader
        title="Fragebogen"
        description="Kurze Fragen mit Ja, Nein oder eigener Antwort – FallFlow stellt danach alles automatisch ein. Jede Antwort gilt sofort."
      />
      <div className="max-w-3xl">
        <SetupQuestionnaire canEdit={can(session.role, "assistant:manage")} />
      </div>
    </>
  );
}
