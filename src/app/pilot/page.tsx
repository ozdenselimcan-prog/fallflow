import type { Metadata } from "next";
import { PilotPage } from "@/components/landing/pilot-page";

export const metadata: Metadata = {
  title: "Pilotbetrieb werden",
  description: "7 Tage kostenlos testen, danach dauerhaft 69 € statt 99 € – FallFlow beantwortet Ihre Kundenanfragen, die Einrichtung übernehmen wir.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PilotPage />;
}
