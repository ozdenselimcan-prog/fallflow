import type { Metadata } from "next";
import { BookingPicker } from "@/components/booking/booking-picker";
import { Logo } from "@/components/ui/logo";
import { EmptyState } from "@/components/ui/states";
import { findUploadContext } from "@/lib/data";
import { freeSlotsForBooking } from "@/lib/intake/case-ops";
import { formatSlot } from "@/lib/intake/scheduling";

export const metadata: Metadata = { title: "Termin wählen", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Öffentliche Buchungsseite für Kunden (nur mit dem geheimen Link des Falls): freie Termine des Betriebs, ein Klick zum Buchen. */
export default async function BookingPage({ params }: PageProps<"/termin/[token]">) {
  const { token } = await params;
  const found = await findUploadContext(token).catch(() => null);
  if (!found) {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16">
        <EmptyState title="Dieser Link ist ungültig oder abgelaufen." description="Bitte wenden Sie sich an den Betrieb und bitten Sie um einen neuen Link." />
      </main>
    );
  }
  const { store, caseRecord } = found;
  const [company, appointments, days] = await Promise.all([store.getCompany(), store.listAppointments(), freeSlotsForBooking(store, caseRecord)]);
  const current = appointments.find((a) => a.caseId === caseRecord.id && (a.status === "proposed" || a.status === "confirmed"));
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-14">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Logo />
        <span className="text-sm text-muted-foreground">{company.name}</span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Wunschtermin wählen</h1>
      <p className="mt-2 text-muted-foreground">
        {company.name}
        {caseRecord.fields.service ? ` · ${caseRecord.fields.service}` : ""} – wählen Sie einfach einen freien Termin aus.
      </p>
      <BookingPicker
        token={token}
        days={days}
        current={current ? { label: formatSlot(new Date(current.startsAt)), confirmed: current.status === "confirmed" } : null}
        phone={company.phone}
      />
    </main>
  );
}
