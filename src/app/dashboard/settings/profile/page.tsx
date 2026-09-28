import type { Metadata } from "next";
import { SettingsBoard } from "@/components/dashboard/settings-board";
import { requireSession } from "@/lib/auth/session";
import { loadSettingsData } from "@/lib/dashboard/settings-data";
import { getStore } from "@/lib/data";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfileSettingsPage() {
  const session = await requireSession();
  const data = await loadSettingsData(session, await getStore(session));
  return <SettingsBoard data={data} initialTab="profile" />;
}
