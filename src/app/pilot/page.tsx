import type { Metadata } from "next";
import { PilotPage } from "@/components/landing/pilot-page";

export const metadata: Metadata = {
  title: "Pilotbetrieb werden",
  description: "1 Monat kostenlos testen – FallFlow beantwortet Ihre Kundenanfragen, die Einrichtung übernehmen wir persönlich.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PilotPage />;
}
