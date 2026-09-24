import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { UploadPanel } from "@/components/upload/upload-panel";
import { Logo } from "@/components/ui/logo";
import { EmptyState } from "@/components/ui/states";
import { findUploadContext } from "@/lib/data";
import { storageAvailable } from "@/lib/documents/storage";
import { buildChecklist } from "@/lib/intake/checklist";

export const metadata: Metadata = { title: "Unterlagen hochladen", robots: { index: false, follow: false } };

/** Öffentliche Upload-Seite für Kunden (Zugriff nur mit dem geheimen Link-Token). Zeigt keine personenbezogenen Falldaten. */
export default async function UploadPage({ params }: PageProps<"/upload/[token]">) {
  const { token } = await params;
  const found = await findUploadContext(token).catch(() => null);

  if (!found) {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16">
        <EmptyState title="Dieser Link ist ungültig oder abgelaufen." description="Bitte wenden Sie sich an Ihr Energieberatungsbüro und bitten Sie um einen neuen Link." />
      </main>
    );
  }

  const { store, caseRecord } = found;
  const [questions, documents, company] = await Promise.all([store.listQuestions(), store.listDocuments(caseRecord.id), store.getCompany()]);
  const checklist = buildChecklist({ questions, fields: caseRecord.fields, documents });
  const items = checklist.items.filter((i) => i.kind === "document").map((i) => ({ kind: i.key.replace("doc:", ""), label: i.label, required: i.required, done: i.done }));
  const open = items.filter((i) => i.required && !i.done).length;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Unterlagen für Ihren Beratungstermin</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {company.name} bereitet Ihren Beratungsfall vor.{" "}
        {open > 0 ? `Bitte laden Sie die folgenden Unterlagen hoch (${open} ${open === 1 ? "Dokument fehlt" : "Dokumente fehlen"} noch).` : "Alle benötigten Unterlagen sind bei uns angekommen – vielen Dank!"}
      </p>
      <UploadPanel className="mt-6" token={token} items={items} uploadsAvailable={storageAvailable()} />
      <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        Die Übertragung ist verschlüsselt. Ihre Dateien sind nicht öffentlich und nur für das Beratungsbüro sichtbar. Dieser persönliche Link erlaubt ausschließlich das Hochladen.
      </p>
    </main>
  );
}
