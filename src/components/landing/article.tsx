import Link from "next/link";
import type { ReactNode } from "react";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { buttonStyles } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";
import { ldJson } from "@/lib/seo";

/** Rahmen für Ratgeber-Artikel (/ratgeber/…): Überschrift, Text, Hinweis auf FallFlow am Ende, strukturierte Daten für Google. */
export function Article({ path, title, intro, published, children }: { path: string; title: string; intro: string; published: string; children: ReactNode }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: intro,
    datePublished: published,
    dateModified: published,
    inLanguage: "de-DE",
    mainEntityOfPage: `${siteConfig.appUrl}${path}`,
    author: { "@type": "Organization", name: siteConfig.name, url: siteConfig.appUrl },
    publisher: { "@type": "Organization", name: siteConfig.name, logo: { "@type": "ImageObject", url: `${siteConfig.appUrl}/brand/logo-full.png` } },
  };
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <Link href="/ratgeber" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          ← Ratgeber
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{intro}</p>
        <div className="article mt-8 space-y-5 leading-relaxed">{children}</div>
        <aside className="mt-12 rounded-2xl bg-zinc-900 p-6 text-white sm:p-8">
          <p className="text-xl font-bold">Das alles automatisch – auch abends und am Wochenende.</p>
          <p className="mt-2 text-zinc-300">
            FallFlow beantwortet Ihre Kundenanfragen per E-Mail und WhatsApp in wenigen Minuten, mit Ihren eigenen Texten, fragt fehlende Angaben und Fotos ab und legt Ihnen
            den fertig vorbereiteten Auftrag hin.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link href="/einrichtung" className={buttonStyles({ className: "bg-white text-black hover:bg-white" })}>
              Kostenlos einrichten lassen
            </Link>
            <Link href="/signup" className={buttonStyles({ variant: "secondary" })}>
              Selbst einrichten
            </Link>
          </div>
        </aside>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(ld)} />
    </>
  );
}

/** Vorlage zum Kopieren (Mail-Text) im Ratgeber. */
export function Template({ title, children }: { title: string; children: string }) {
  return (
    <figure className="my-6 rounded-xl border border-border bg-card">
      <figcaption className="border-b border-border px-4 py-2.5 text-sm font-semibold">{title}</figcaption>
      <pre className="whitespace-pre-wrap px-4 py-4 font-sans text-[15px] leading-relaxed">{children}</pre>
    </figure>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="pt-6 text-2xl font-bold tracking-tight">{children}</h2>;
}
