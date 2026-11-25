import type { Metadata } from "next";
import { ConversionPing } from "@/components/consent/consent-banner";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { SupportBanner } from "@/components/dashboard/support-banner";
import { CORE_FIELD_KEYS } from "@/lib/ai/business-profile";
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
  const [company, channels, connections, documentTemplates, serviceMessages, assistant, questions] = await Promise.all([
    store.getCompany(),
    store.listChannels(),
    listConnections(session.companyId),
    store.listDocumentTemplates(),
    store.listServiceMessages(),
    store.getAssistant(),
    store.listQuestions(),
  ]);

  const byProvider = new Map(connections.map((c) => [c.provider, toStatus(c)]));
  // Bisherige Antworten aus dem Einrichtungs-Gespräch – wer unterbricht, macht mit seinen Antworten weiter.
  const bp = company.businessProfile;
  const greetingText = bp.texts?.["email.greeting"] ?? "";
  const signoff = bp.texts?.["email.signoff"] ?? "";
  const interviewInitial = {
    customers: bp.interview?.customers ?? [],
    area: bp.interview?.area ?? "",
    strengths: bp.interview?.strengths ?? [],
    faqs: bp.knowledge?.faqs ?? [],
    tone: assistant.tone,
    greeting: greetingText.startsWith("Hallo") ? ("hallo" as const) : greetingText.startsWith("Sehr geehrte") ? ("sehr-geehrte" as const) : ("guten-tag" as const),
    signature: signoff.includes("\n") ? signoff.split("\n").slice(1).join(" ").replace("{firma}", "").trim() : "",
  };

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <Logo className="mb-8" href="/" />
      {session.support && (
        <div className="w-full max-w-3xl">
          <SupportBanner companyName={session.support.companyName} />
        </div>
      )}
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
        assistant={assistant}
        interviewInitial={interviewInitial}
        initialProfile={
          company.businessProfile.industry
            ? {
                ...company.businessProfile,
                services: company.services,
                fields: questions.filter((q) => !CORE_FIELD_KEYS.includes(q.key as (typeof CORE_FIELD_KEYS)[number]) && !q.whatsappOnly).map((q) => ({ key: q.key, label: q.label, prompt: q.prompt, required: q.required, services: q.appliesTo ?? [] })),
              }
            : undefined
        }
      />
    </main>
  );
}
