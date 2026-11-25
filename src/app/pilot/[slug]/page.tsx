import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PilotPage } from "@/components/landing/pilot-page";
import { INDUSTRY_FILMS } from "@/lib/config/industry-films";
import { INDUSTRY_PAGES } from "@/lib/config/industry-pages";

/** Pilot-Seite je Branche (QR-Code in den Briefen, z. B. /pilot/dachdecker) – nicht für Suchmaschinen. */
export const generateStaticParams = () => INDUSTRY_PAGES.map((p) => ({ slug: p.slug }));
export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/pilot/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = INDUSTRY_PAGES.find((p) => p.slug === slug);
  return {
    title: page ? `Pilotbetrieb werden – ${page.audience}` : "Pilotbetrieb werden",
    description: "1 Monat kostenlos testen – FallFlow beantwortet Ihre Kundenanfragen, die Einrichtung übernehmen wir persönlich.",
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: PageProps<"/pilot/[slug]">) {
  const { slug } = await params;
  const page = INDUSTRY_PAGES.find((p) => p.slug === slug);
  if (!page) notFound();
  return <PilotPage audience={page.audience} film={INDUSTRY_FILMS[page.slug]} />;
}
