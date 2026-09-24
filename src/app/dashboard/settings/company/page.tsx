import type { Metadata } from "next";
import { CompanyForm } from "@/components/dashboard/settings-forms";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";

export const metadata: Metadata = { title: "Unternehmen" };

export default async function CompanySettingsPage() {
  const session = await requireSession();
  const c = await (await getStore(session)).getCompany();
  return <CompanyForm initial={{ name: c.name, website: c.website, phone: c.phone, address: c.address }} canEdit={can(session.role, "company:manage")} />;
}
