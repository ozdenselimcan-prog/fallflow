import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { QuestionBuilder } from "@/components/dashboard/question-builder";
import { PageHeader } from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";

export const metadata: Metadata = { title: "Frage-Flow" };

export default async function QuestionsPage() {
  const session = await requireSession();
  const store = await getStore(session);
  const questions = await store.listQuestions();

  return (
    <>
      <Link href="/dashboard/assistant" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> KI-Assistent
      </Link>
      <PageHeader title="Frage-Flow" description="Der Assistent stellt die aktiven Fragen in dieser Reihenfolge, solange die Angabe noch fehlt." />
      <QuestionBuilder questions={questions} canEdit={can(session.role, "assistant:manage")} />
    </>
  );
}
