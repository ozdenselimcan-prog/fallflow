import type { ReactNode } from "react";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";

/** Gemeinsamer Rahmen der Rechtstexte (AGB, AVV): Navigation, Überschrift, Stand, lesbare Abschnitte. */
export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Stand: {updated}</p>
        {intro && <div className="mt-4 leading-relaxed">{intro}</div>}
        <div className="mt-8 space-y-8 leading-relaxed [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold">{children}</div>
      </main>
      <Footer />
    </>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export const List = ({ items }: { items: ReactNode[] }) => (
  <ul className="list-disc space-y-1 pl-5">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);

/** Nummerierte Absätze (1), (2), … innerhalb eines Paragraphen. */
export const Paragraphs = ({ items }: { items: ReactNode[] }) => (
  <ol className="space-y-2">
    {items.map((item, i) => (
      <li key={i} className="flex gap-2">
        <span className="shrink-0 text-muted-foreground">({i + 1})</span>
        <span>{item}</span>
      </li>
    ))}
  </ol>
);
