import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { AssistantForm } from "@/components/dashboard/assistant-form";
import { AssistantPreview } from "@/components/dashboard/assistant-preview";
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
        description="Legen Sie fest, wie der Assistent Anfragen entgegennimmt."
        action={
          <Link href="/dashboard/assistant/questions" className={buttonStyles({ variant: "secondary" })}>
            <ListChecks className="size-4" /> Fragen bearbeiten
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <AssistantForm initial={assistant} canEdit={can(session.role, "assistant:manage")} />
        <AssistantPreview name={assistant.name} greeting={assistant.greeting} />
      </div>
    </>
  );
}
