import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BusinessProfileCard } from "@/components/dashboard/business-profile-card";
import { PageHeader } from "@/components/ui/card";
import { CORE_FIELD_KEYS } from "@/lib/ai/business-profile";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";

export const metadata: Metadata = { title: "Ihr Betrieb" };

export default async function BusinessProfilePage() {
  const session = await requireSession();
  const store = await getStore(session);
  const [company, questions] = await Promise.all([store.getCompany(), store.listQuestions()]);
  const core: readonly string[] = CORE_FIELD_KEYS;

  return (
    <>
      <Link href="/dashboard/assistant" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> KI-Assistent
      </Link>
      <PageHeader
        title="Ihr Betrieb"
        description="Branche, Leistungen, die Angaben, die der Assistent erfragt, die Unterlagen, die Kunden schicken sollen, und die Themen, bei denen Sie selbst antworten."
      />
      <BusinessProfileCard
        website={company.website}
        canEdit={can(session.role, "company:manage")}
        initial={{
          industry: company.businessProfile.industry,
          description: company.businessProfile.description,
          services: company.services.filter((s) => s !== "Sonstiges"),
          fields: questions.filter((q) => !core.includes(q.key) && !q.whatsappOnly).map((q) => ({ key: q.key, label: q.label, prompt: q.prompt, required: q.required, services: q.appliesTo ?? [] })),
          documents: company.businessProfile.documents,
          humanTopics: company.businessProfile.humanTopics,
          documentsByService: company.businessProfile.documentsByService,
          needsAddress: company.businessProfile.needsAddress ?? true,
        }}
      />
    </>
  );
}
