import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CheckoutConversion } from "@/components/consent/consent-banner";
import { PaymentSetup } from "@/components/dashboard/payment-setup";
import { needsPaymentSetup, trialDaysLeft } from "@/lib/billing/access";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { DashboardShell } from "@/components/dashboard/shell";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const session = await requireSession();
  const store = await getStore(session);
  const [company, stats, subscription] = await Promise.all([store.getCompany(), store.getStats(), store.getSubscription()]);
  if (!company.onboardingCompleted && can(session.role, "company:manage") && !session.demo) redirect("/onboarding");

  return (
    <DashboardShell
      companyName={company.name}
      userName={[session.firstName, session.lastName].filter(Boolean).join(" ") || session.email}
      userEmail={session.email}
      openRequests={stats.newRequests}
      attentionCount={stats.needsAttention}
      demo={session.demo}
    >
      {/* Google-Ads-Conversion "Testphase gestartet" (nur mit Einwilligung, siehe lib/tracking.ts). */}
      <Suspense>
        <CheckoutConversion />
      </Suspense>
      {/* Testphase ohne Zahlungsmethode abgelaufen: nur noch die Bezahlseite. Während der Testphase: Hinweis oben. */}
      {!session.demo && needsPaymentSetup(company, subscription) ? (
        <Suspense>
          <PaymentSetup canManage={can(session.role, "billing:manage")} preferredPlan={session.signupPlan} daysLeft={0} />
        </Suspense>
      ) : (
        <>
          {!session.demo && (trialDaysLeft(company, subscription) ?? 0) > 0 && (
            <TrialBanner daysLeft={trialDaysLeft(company, subscription)!} canManage={can(session.role, "billing:manage")} />
          )}
          {children}
        </>
      )}
    </DashboardShell>
  );
}
