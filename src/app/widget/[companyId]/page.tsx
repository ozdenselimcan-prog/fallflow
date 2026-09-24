import type { Metadata } from "next";
import { WidgetChat } from "@/components/chat/widget-chat";
import { EmptyState } from "@/components/ui/states";
import { getPublicStore } from "@/lib/data";

export const metadata: Metadata = { title: "Beratung anfragen", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Inhalt des Widget-iframes (wird von /widget.js eingebettet). */
export default async function WidgetPage({ params }: PageProps<"/widget/[companyId]">) {
  const { companyId } = await params;
  const store = UUID.test(companyId) || companyId === "demo" ? await getPublicStore(companyId).catch(() => null) : null;
  if (!store) return <EmptyState title="Chat nicht verfügbar" description="Die Company-ID ist ungültig oder der Chat ist derzeit nicht erreichbar." />;

  const assistant = await store.getAssistant();
  return (
    <div className="h-dvh bg-card">
      <WidgetChat companyId={companyId} assistantName={assistant.name} greeting={assistant.greeting} />
    </div>
  );
}
