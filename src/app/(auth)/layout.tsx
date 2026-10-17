import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Clock, CreditCard, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Notice } from "@/components/ui/states";
import { siteConfig } from "@/lib/config/site";
import { isSupabaseConfigured } from "@/lib/utils";

const benefits = [
  "Kundenanfragen werden automatisch beantwortet – mit Ihren Texten",
  "Formulare und Unterlagen werden angefordert und geprüft",
  "Fehlende Angaben fordert FallFlow selbst nach",
  "Sie erhalten nur noch fertig vorbereitete Fälle",
];

const trust = [
  { icon: ShieldCheck, text: "Server in der EU · DSGVO" },
  { icon: CreditCard, text: "Testen ohne Kreditkarte" },
  { icon: Clock, text: "In 10 Minuten eingerichtet" },
];

/** Anmelden / Registrieren: links FallFlow (ab Desktop), rechts das Formular. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-neutral-950 p-12 text-white lg:flex">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-white/5" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 size-[24rem] rounded-full bg-white/5" />
        <Link href="/" className="relative inline-flex w-fit">
          <Image src="/brand/logo-full.png" alt={siteConfig.name} width={775} height={209} priority className="h-8 w-auto brightness-0 invert" />
        </Link>

        <div className="relative max-w-lg">
          <p className="text-sm font-medium uppercase tracking-wider text-white/60">Für Energieberater</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-tight">Weniger Büroarbeit. Mehr Zeit für Beratung.</h2>
          <ul className="mt-8 space-y-3.5">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-3 text-white/85">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-white" aria-hidden />
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-xl bg-white p-5 text-neutral-900 shadow-2xl" aria-label="Beispiel einer fertigen Fallakte">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-neutral-500">BERATUNGSFALL</span>
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Bereit zur Prüfung</span>
            </div>
            <p className="mt-2 text-lg font-semibold">Familie Schneider</p>
            <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {["EFH", "Baujahr 1974", "168 m²", "Gasheizung", "iSFP"].map((t) => (
                <li key={t} className="rounded-full bg-neutral-100 px-2.5 py-1">
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
              <span>Vollständigkeit</span>
              <span className="font-semibold text-neutral-900">100 %</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-neutral-900" />
          </div>
        </div>

        <ul className="relative flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
          {trust.map(({ icon: I, text }) => (
            <li key={text} className="flex items-center gap-2">
              <I className="size-4" aria-hidden /> {text}
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <Logo className="mb-8 lg:hidden" />
        <div className="w-full max-w-md space-y-4">
          {!isSupabaseConfigured() && (
            <Notice>
              Demo-Modus: Supabase ist nicht konfiguriert. Anmeldung und Registrierung führen direkt in die Demo-Umgebung, die Daten liegen nur im Arbeitsspeicher.
            </Notice>
          )}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8 lg:border-0 lg:p-0 lg:shadow-none">{children}</div>
          <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 pt-2 text-xs text-muted-foreground lg:hidden">
            {trust.map(({ icon: I, text }) => (
              <li key={text} className="flex items-center gap-1.5">
                <I className="size-3.5" aria-hidden /> {text}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
