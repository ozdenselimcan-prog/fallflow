import type { Metadata } from "next";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { Logo } from "@/components/ui/logo";
import { requireSession } from "@/lib/auth/session";
import { siteConfig } from "@/lib/config/site";
import { getStore } from "@/lib/data";

export const metadata: Metadata = { title: "Onboarding" };

/** Erfassbare Standardfelder (Schritt 4). Weitere, eigene Fragen pflegt man im Frage-Flow. */
const STANDARD_KEYS = ["name", "email", "phone", "postalCode", "buildingType", "yearBuilt", "livingArea", "heating", "service"];

export default async function OnboardingPage() {
  const session = await requireSession();
  const store = await getStore(session);
  const [company, questions, cases] = await Promise.all([store.getCompany(), store.listQuestions(), store.listCases()]);

  const fieldOptions = STANDARD_KEYS.map((key) => questions.find((q) => q.key === key)).filter((q) => q !== undefined).map((q) => ({ key: q.key, label: q.label, active: q.active }));

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <Logo className="mb-8" href="/" />
      <OnboardingWizard
        firstName={session.firstName}
        companyId={company.id}
        appUrl={siteConfig.appUrl}
        initial={{ name: company.name, website: company.website, phone: company.phone, address: company.address, services: company.services }}
        fieldOptions={fieldOptions}
        widgetReceived={cases.some((c) => c.source === "widget")}
      />
    </main>
  );
}
