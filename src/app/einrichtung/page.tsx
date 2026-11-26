import type { Metadata } from "next";
import { Check } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/landing/footer";
import { ManagedSetupForm } from "@/components/landing/managed-setup-form";
import { Navbar } from "@/components/landing/navbar";
import { SetupRequestForm } from "@/components/landing/setup-request-form";

export const metadata: Metadata = {
  title: "Wir richten FallFlow für Sie ein",
  description: "Ein paar Fragen zu Ihrem Betrieb beantworten – wir richten FallFlow komplett für Sie ein und schicken Ihnen den fertigen Zugang. Kostenlos.",
  alternates: { canonical: "/einrichtung" },
};

const points = [
  "Ein paar Fragen zu Ihrem Betrieb – dauert etwa 5 Minuten",
  "Wir richten Leistungen, Rückfragen und Texte für jede Leistung ein",
  "Wir prüfen alles persönlich, bevor es losgeht",
  "Sie bekommen den fertigen Zugang per E-Mail und testen 7 Tage kostenlos",
];

export default function SetupPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Wir richten FallFlow für Sie ein.</h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">Keine Lust auf Einstellungen? Erzählen Sie uns kurz von Ihrem Betrieb – den Rest machen wir.</p>
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
              </Link>
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <ManagedSetupForm />
          </div>
        </div>
        <details className="mx-auto mt-12 max-w-xl rounded-2xl border border-border bg-card p-6">
          <summary className="cursor-pointer font-semibold">Lieber kurz telefonieren? Rückruf anfordern</summary>
          <p className="mt-2 mb-5 text-sm text-muted-foreground">Wir melden uns in der Regel innerhalb eines Werktags und richten FallFlow gemeinsam mit Ihnen ein.</p>
          <SetupRequestForm />
        </details>
      </main>
      <Footer />
    </>
  );
}
