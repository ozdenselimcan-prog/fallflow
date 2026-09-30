import type { Metadata } from "next";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { Logo } from "@/components/ui/logo";
import { requireSession } from "@/lib/auth/session";
import { siteConfig } from "@/lib/config/site";
import { getStore } from "@/lib/data";
import { listConnections, toStatus } from "@/lib/integrations/connections-store";
import { appConfigured as whatsappAppConfigured } from "@/lib/integrations/whatsapp";

export const metadata: Metadata = { title: "Onboarding" };

/** Erfassbare Standardfelder (Schritt 4). Weitere, eigene Fragen pflegt man im Frage-Flow. */
const STANDARD_KEYS = ["service", "buildingType", "yearBuilt", "livingArea", "heating", "ownerStatus", "street", "postalCode", "floors", "name", "email", "phone"];

export default async function OnboardingPage() {
  const session = await requireSession();
  const store = await getStore(session);
  const [company, questions, cases, connections] = await Promise.all([
    store.getCompany(),
    store.listQuestions(),
    store.listCases(),
    listConnections(session.companyId),
  ]);

  const fieldOptions = STANDARD_KEYS.map((key) => questions.find((q) => q.key === key)).filter((q) => q !== undefined).map((q) => ({ key: q.key, label: q.label, active: q.active }));
  const byProvider = new Map(connections.map((c) => [c.provider, toStatus(c)]));

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
        connections={{ gmail: byProvider.get("gmail") ?? null, microsoft: byProvider.get("microsoft") ?? null, whatsapp: byProvider.get("whatsapp") ?? null, whatsappAppConfigured: whatsappAppConfigured() }}
      />
    </main>
  );
}
