import type { Metadata } from "next";
import { ProfileForm } from "@/components/dashboard/settings-forms";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfileSettingsPage() {
  const s = await requireSession();
  return <ProfileForm firstName={s.firstName} lastName={s.lastName} email={s.email} />;
}
