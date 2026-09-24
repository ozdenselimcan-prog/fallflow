import type { Metadata } from "next";
import { CaseTable } from "@/components/dashboard/case-table";
import { PageHeader } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";

export const metadata: Metadata = { title: "Anfragen" };

/** Posteingang: Anfragen, die noch nicht übernommen wurden (neu oder mit offener Rückfrage). */
export default async function RequestsPage() {
  const session = await requireSession();
  const store = await getStore(session);
  const cases = (await store.listCases()).filter((c) => c.status === "NEW" || c.status === "NEEDS_INFO");

  return (
    <>
      <PageHeader title="Anfragen" description="Eingehende Anfragen, die noch vervollständigt oder übernommen werden müssen." />
      <CaseTable cases={cases} emptyDescription="Keine offenen Anfragen. Neue Anfragen erscheinen hier, sobald sie eingehen." />
    </>
  );
}
