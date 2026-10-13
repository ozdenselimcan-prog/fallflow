import type { Metadata } from "next";
import { ConversionPing } from "@/components/consent/consent-banner";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { Logo } from "@/components/ui/logo";
import { requireSession } from "@/lib/auth/session";
import { siteConfig } from "@/lib/config/site";
import { getStore } from "@/lib/data";
import { listConnections, toStatus } from "@/lib/integrations/connections-store";
import { microsoftProvider } from "@/lib/integrations/microsoft";

export const metadata: Metadata = { title: "Onboarding" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const { integration } = await searchParams;
  const session = await requireSession();
  const store = await getStore(session);
  const [company, channels, connections, documentTemplates, serviceMessages] = await Promise.all([
    store.getCompany(),
    store.listChannels(),
    listConnections(session.companyId),
    store.listDocumentTemplates(),
    store.listServiceMessages(),
  ]);

  const byProvider = new Map(connections.map((c) => [c.provider, toStatus(c)]));

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <Logo className="mb-8" href="/" />
      {/* Google-Ads-Conversion "Registrierung" (einmal pro Browser, nur mit Einwilligung). */}
      <ConversionPing kind="signup" />
      <OnboardingWizard
        firstName={session.firstName}
        companyId={company.id}
        appUrl={siteConfig.appUrl}
        initial={{ name: company.name, website: company.website, phone: company.phone, address: company.address, services: company.services }}
        widgetReceived={channels.some((c) => c.kind === "website" && c.status === "connected")}
        integrationResult={typeof integration === "string" ? integration : undefined}
        connections={{ gmail: byProvider.get("microsoft") ?? byProvider.get("gmail") ?? null, microsoftAvailable: microsoftProvider.missingConfig().length === 0 }}
        documentTemplates={documentTemplates.map((t) => ({ id: t.id, service: t.service, title: t.title, fileName: t.fileName, alwaysInclude: t.alwaysInclude, requiresReturn: t.requiresReturn }))}
        serviceMessages={serviceMessages.map((m) => ({ service: m.service, body: m.body, appointmentNote: m.appointmentNote }))}
      />
    </main>
  );
}
