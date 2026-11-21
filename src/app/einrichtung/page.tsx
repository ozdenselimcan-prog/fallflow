import type { Metadata } from "next";
import { Check } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { SetupRequestForm } from "@/components/landing/setup-request-form";

export const metadata: Metadata = {
  title: "Persönliche Einrichtung",
  description: "Wir richten FallFlow in einem kurzen Telefonat gemeinsam mit Ihnen ein – kostenlos, ohne Vorbereitung.",
  alternates: { canonical: "/einrichtung" },
};

const points = [
  "Kostenlos und unverbindlich, etwa 20 Minuten am Telefon",
  "Wir richten Leistungen, Texte und Vorlagen für Ihren Betrieb ein",
  "E-Mail-Weiterleitung gemeinsam einschalten – ohne Passwort-Weitergabe",
  "Sie müssen nichts vorbereiten",
];

export default function SetupPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Wir richten FallFlow für Sie ein.</h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">Keine Lust auf Einstellungen? Wir rufen Sie an und machen das gemeinsam mit Ihnen.</p>
            <ul className="mt-6 space-y-3">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <Check className="mt-0.5 size-5 shrink-0 text-accent" />
                  {p}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-muted-foreground">
              Lieber gleich selbst loslegen?{" "}
              <Link href="/signup" className="font-medium text-foreground underline underline-offset-2">
                7 Tage kostenlos testen
              </Link>{" "}
              – die Einrichtung durch uns können Sie auch danach jederzeit anfragen.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold">Rückruf für die Einrichtung</h2>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">Wir melden uns in der Regel innerhalb eines Werktags.</p>
            <SetupRequestForm />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
