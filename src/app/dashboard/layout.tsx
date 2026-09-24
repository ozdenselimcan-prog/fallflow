import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/shell";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const session = await requireSession();
  const store = await getStore(session);
  const [company, stats] = await Promise.all([store.getCompany(), store.getStats()]);
  if (!company.onboardingCompleted && can(session.role, "company:manage") && !session.demo) redirect("/onboarding");

  return (
    <DashboardShell
      companyName={company.name}
      userName={[session.firstName, session.lastName].filter(Boolean).join(" ") || session.email}
      userEmail={session.email}
      openRequests={stats.newRequests}
      demo={session.demo}
    >
      {children}
    </DashboardShell>
  );
}
