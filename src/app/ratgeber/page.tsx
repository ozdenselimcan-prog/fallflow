import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { ARTICLES } from "@/lib/config/ratgeber";

export const metadata: Metadata = {
  title: "Ratgeber für Handwerker: Kundenanfragen, Vorlagen, Checklisten",
  description: "Praktische Hilfe für Handwerksbetriebe: Muster für Antworten auf Kundenanfragen, Checklisten für Angebote und Tipps, wie keine Anfrage liegen bleibt.",
  alternates: { canonical: "/ratgeber" },
};

export default function RatgeberPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Ratgeber für Handwerksbetriebe</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">Vorlagen, Checklisten und Tipps rund um Kundenanfragen – kostenlos und ohne Anmeldung.</p>
        <ul className="mt-8 space-y-4">
          {ARTICLES.map((a) => (
            <li key={a.href}>
              <Link href={a.href} className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/30">
                <p className="text-lg font-semibold">{a.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{a.text}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
