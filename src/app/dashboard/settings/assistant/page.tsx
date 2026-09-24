import type { Metadata } from "next";
import Link from "next/link";
import { AssistantForm } from "@/components/dashboard/assistant-form";
import { buttonStyles } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";

export const metadata: Metadata = { title: "Assistent-Einstellungen" };

export default async function AssistantSettingsPage() {
  const session = await requireSession();
  const assistant = await (await getStore(session)).getAssistant();
  return (
    <div className="space-y-4">
      <AssistantForm initial={assistant} canEdit={can(session.role, "assistant:manage")} />
      <Link href="/dashboard/assistant/questions" className={buttonStyles({ variant: "secondary" })}>
        Frage-Flow bearbeiten
      </Link>
    </div>
  );
}
