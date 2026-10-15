import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PaymentSetup } from "@/components/dashboard/payment-setup";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { trialDaysLeft } from "@/lib/billing/access";
import { getStore } from "@/lib/data";

export const metadata: Metadata = { title: "Zahlungsmethode hinterlegen" };

/** Plan wählen und Zahlungsmethode hinterlegen, solange die kostenlose Testphase noch läuft (Link im Testphasen-Hinweis). */
export default async function PaymentPage() {
  const session = await requireSession();
  const store = await getStore(session);
  const [company, subscription] = await Promise.all([store.getCompany(), store.getSubscription()]);
  const daysLeft = trialDaysLeft(company, subscription);
  // Schon ein Abo hinterlegt bzw. gar keine Testphase ohne Karte: zur normalen Abrechnung.
  if (daysLeft === null) redirect("/dashboard/settings/billing");
  return (
    <Suspense>
      <PaymentSetup canManage={can(session.role, "billing:manage")} preferredPlan={session.signupPlan} daysLeft={daysLeft} />
    </Suspense>
  );
}
