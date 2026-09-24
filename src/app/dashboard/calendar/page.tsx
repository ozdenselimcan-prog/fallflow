import type { Metadata } from "next";
import { Calendar } from "@/components/dashboard/calendar";
import { PageHeader } from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";

export const metadata: Metadata = { title: "Termine" };

export default async function CalendarPage() {
  const session = await requireSession();
  const store = await getStore(session);
  const appointments = await store.listAppointments();

  return (
    <>
      <PageHeader title="Termine" description="Beratungstermine anlegen, verschieben und löschen. Kalender-Synchronisation (Google/Microsoft) folgt später." />
      <Calendar appointments={appointments} canWrite={can(session.role, "appointments:write")} />
    </>
  );
}
