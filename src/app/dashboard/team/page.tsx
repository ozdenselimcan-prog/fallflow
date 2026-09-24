import type { Metadata } from "next";
import { TeamManager } from "@/components/dashboard/team-manager";
import { PageHeader } from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const session = await requireSession();
  const store = await getStore(session);
  const members = await store.listMembers();

  return (
    <>
      <PageHeader title="Team" description="Inhaber und Admins verwalten Mitarbeiter, Mitarbeiter bearbeiten Fälle und Termine." />
      <TeamManager members={members} canManage={can(session.role, "team:manage")} />
    </>
  );
}
