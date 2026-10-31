"use client";

import Link from "next/link";
import { useState } from "react";
import { CaseFilm } from "@/components/landing/case-film";
import { INDUSTRY_FILMS } from "@/lib/config/industry-films";
import { INDUSTRY_PAGES } from "@/lib/config/industry-pages";
import { cn } from "@/lib/utils";

const CHOICES = INDUSTRY_PAGES.filter((p) => INDUSTRY_FILMS[p.slug]);

/** Fall-Film auf der Startseite mit Branchenauswahl: Jeder Besucher sieht ein Beispiel aus seiner eigenen Branche. */
export function IndustryFilm() {
  const [slug, setSlug] = useState(CHOICES[0]?.slug ?? "dachdecker");
  const page = CHOICES.find((p) => p.slug === slug);
  return (
    <div>
      <div className="mb-5">
        <p className="mb-2 text-sm font-medium text-muted-foreground">Beispiel aus Ihrer Branche:</p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {CHOICES.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => setSlug(p.slug)}
              aria-pressed={p.slug === slug}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                p.slug === slug ? "border-accent bg-accent text-white" : "border-border bg-card text-foreground hover:border-accent/50",
              )}
            >
              {p.audience}
            </button>
          ))}
        </div>
      </div>
      <CaseFilm key={slug} scenario={INDUSTRY_FILMS[slug]} />
      {page && (
        <p className="mt-4 text-sm text-muted-foreground">
          Mehr zu FallFlow für {page.audience}:{" "}
          <Link href={`/branchen/${page.slug}`} className="font-medium text-accent hover:underline">
            Branchenseite ansehen
          </Link>
        </p>
      )}
    </div>
  );
}
