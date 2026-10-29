import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/landing/footer";
import { MobileCta } from "@/components/landing/mobile-cta";
import { Navbar } from "@/components/landing/navbar";
import { FinalCta } from "@/components/landing/sections";
import { Card } from "@/components/ui/card";
import { INDUSTRY_PAGES } from "@/lib/config/industry-pages";

export const metadata: Metadata = {
  title: "Branchen: KI für Kundenanfragen in Handwerk und Dienstleistung",
  description: "Für Dachdecker, Elektriker, Maler, SHK-Betriebe, Hausverwaltungen, Werkstätten, Friseure und viele mehr: Die KI beantwortet Kundenanfragen per E-Mail und WhatsApp.",
  alternates: { canonical: "/branchen" },
};

export default function IndustriesPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Für Ihre Branche eingerichtet</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Für jede Branche gibt es eine fertige Vorlage mit typischen Leistungen, Angaben und Unterlagen. Ihre Branche ist nicht dabei? Beschreiben Sie Ihren Betrieb in zwei Sätzen – die KI richtet den Rest ein.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRY_PAGES.map((p) => (
            <li key={p.slug}>
              <Link href={`/branchen/${p.slug}`} className="block h-full">
                <Card className="h-full p-5 transition-colors hover:border-accent">
                  <h2 className="flex items-center justify-between font-semibold">
                    {p.audience} <ArrowRight className="size-4 text-muted-foreground" />
                  </h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">{p.headline}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <FinalCta />
      <Footer />
      <MobileCta />
    </>
  );
}
