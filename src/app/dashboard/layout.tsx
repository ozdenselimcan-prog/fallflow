import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PaymentSetup } from "@/components/dashboard/payment-setup";
import { needsPaymentSetup } from "@/lib/billing/access";
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
      {/* Neues Büro ohne hinterlegte Zahlungsmethode (Bezahlseite abgebrochen): erst die Testphase starten. */}
      {!session.demo && needsPaymentSetup(company, subscription) ? (
        <Suspense>
          <PaymentSetup canManage={can(session.role, "billing:manage")} preferredPlan={session.signupPlan} trialDays={session.trialDays ?? 7} />
        </Suspense>
      ) : (
        children
      )}
    </DashboardShell>
  );
}
