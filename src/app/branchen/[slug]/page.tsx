import type { Metadata } from "next";
import { ArrowRight, Check, CheckCircle2, MessageCircle, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/landing/footer";
import { MobileCta } from "@/components/landing/mobile-cta";
import { Navbar } from "@/components/landing/navbar";
import { CaseFilm } from "@/components/landing/case-film";
import { FeaturesSection, FinalCta, FlowSection, NoCrmSection, PricingSection, SolutionSection } from "@/components/landing/sections";
import { INDUSTRY_FILMS } from "@/lib/config/industry-films";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { INDUSTRY_PAGES, industryPage } from "@/lib/config/industry-pages";
import { INDUSTRY_PRESETS } from "@/lib/config/industry-presets";
import { siteConfig } from "@/lib/config/site";

export const dynamicParams = false;
export const generateStaticParams = () => INDUSTRY_PAGES.map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: PageProps<"/branchen/[slug]">): Promise<Metadata> {
  const page = industryPage((await params).slug);
  if (!page) return {};
  return { title: page.metaTitle, description: page.metaDescription, alternates: { canonical: `/branchen/${page.slug}` } };
}

const HOW = [
  "Antwort in wenigen Minuten – auch abends und am Wochenende",
  "Fragt nur, was noch fehlt – nach Ihren Vorgaben",
  "Notfälle, Preisfragen und Reklamationen gehen sofort an Sie",
  "Fertige Fallakte mit allen Angaben, Fotos und Terminvorschlag",
];

/** Branchenseite: eigene Texte je Branche, Leistungen und Fragen aus der passenden Branchen-Vorlage. */
export default async function IndustryLandingPage({ params }: PageProps<"/branchen/[slug]">) {
  const page = industryPage((await params).slug);
  const preset = INDUSTRY_PRESETS.find((p) => p.id === page?.preset);
  if (!page || !preset) notFound();
  const questions = preset.fields.slice(0, 4).map((f) => f.prompt);
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <>
      <Navbar />
      <main>
        <section className="hero-grid-bg border-b border-border">
          <div className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 lg:py-20">
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white/80 px-4 py-1.5 text-[13px] font-medium text-zinc-600 shadow-sm">KI für {page.audience}</span>
            <h1 className="mt-5 text-balance text-[clamp(2rem,4.5vw+0.5rem,3.5rem)] font-black leading-[1.05] tracking-[-0.03em] text-zinc-900">{page.headline}</h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-500 sm:text-lg">{page.intro}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup" className={buttonStyles({ size: "lg" })}>
                7 Tage kostenlos testen <ArrowRight className="size-4" />
              </Link>
              <Link href="/demo" className={buttonStyles({ variant: "ghost", size: "lg", className: "border border-zinc-200 bg-white hover:bg-zinc-50" })}>
                Demo ansehen
              </Link>
            </div>
            <p className="mt-4 text-sm text-zinc-400">Ohne Kreditkarte. Mit fertiger Vorlage für {page.audience} – in 10 Minuten eingerichtet.</p>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="max-w-3xl text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">So sieht ein echter Fall bei {page.audience} aus – in Echtzeit.</h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">Von der ersten Kundenmail bis zum bestätigten Termin – links Ihr Postfach, rechts die Fallakte, die {siteConfig.name} dabei automatisch füllt.</p>
            <div className="mt-10">
              <CaseFilm scenario={INDUSTRY_FILMS[page.slug]} />
            </div>
          </div>
        </section>

        <FlowSection />

        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="max-w-3xl text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Kennen Sie das?</h2>
            <ul className="mt-10 grid gap-4 md:grid-cols-3">
              {page.pains.map((p) => (
                <li key={p.title}>
                  <Card className="h-full p-6">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-danger-soft text-danger">
                      <TriangleAlert className="size-5" />
                    </span>
                    <h3 className="mt-4 font-semibold">{p.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-y border-border bg-muted/60 py-16 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">So läuft eine Anfrage mit {siteConfig.name}</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">Per E-Mail, WhatsApp oder im Chat auf Ihrer Website – die KI antwortet mit Ihren Texten und fragt Schritt für Schritt nach.</p>
              <ul className="mt-6 space-y-3 text-sm">
                {HOW.map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <Card className="p-5">
              <p className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground">
                <MessageCircle className="size-4" /> BEISPIEL
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[#dcf8c6] px-4 py-2.5 text-zinc-900">{page.example}</p>
                <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5">Vielen Dank für Ihre Nachricht! {questions[0] ?? "Wie lautet die Adresse?"}</p>
                {questions.slice(1).map((q) => (
                  <p key={q} className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-muted-foreground">
                    {q}
                  </p>
                ))}
              </div>
              <div className="mt-5 flex items-start gap-2 rounded-xl bg-success-soft p-3 text-sm text-success">
                <Sparkles className="mt-0.5 size-4 shrink-0" />
                <span>
                  <span className="font-semibold">Ergebnis: </span>
                  {page.result}
                </span>
              </div>
            </Card>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Vorlage für {page.audience} – sofort startklar</h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">Typische Leistungen und Angaben sind schon vorbereitet. Sie passen alles in wenigen Minuten an.</p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <Card className="p-6">
                <h3 className="font-semibold">Leistungen</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {preset.services.map((s) => (
                    <li key={s} className="rounded-full bg-muted px-3 py-1 text-sm">
                      {s}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold">Was die KI abfragt</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {[...preset.fields.map((f) => f.label), ...preset.documents].map((label) => (
                    <li key={label} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" /> {label}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </section>

        <SolutionSection />
        <FeaturesSection />
        <NoCrmSection />

        <section className="border-y border-border bg-muted/60 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Häufige Fragen von {page.audience}</h2>
            <div className="mt-8 space-y-3">
              {page.faq.map((f) => (
                <details key={f.q} className="group rounded-lg border border-border bg-card px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span className="text-xl leading-none text-muted-foreground transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <PricingSection />
        <section className="pb-4">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-sm text-muted-foreground">
              Weitere Branchen:{" "}
              {INDUSTRY_PAGES.filter((p) => p.slug !== page.slug).map((p, i) => (
                <span key={p.slug}>
                  {i > 0 && " · "}
                  <Link href={`/branchen/${p.slug}`} className="hover:text-foreground hover:underline">
                    {p.audience}
                  </Link>
                </span>
              ))}
            </p>
          </div>
        </section>
        <FinalCta />
      </main>
      <Footer />
      <MobileCta />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
    </>
  );
}
