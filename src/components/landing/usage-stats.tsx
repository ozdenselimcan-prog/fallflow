import { siteConfig } from "@/lib/config/site";

/** Nutzerzahl und Kennzahl-Kasten – unter dem animierten Beispielfall (Startseite und Branchenseiten). */
export function UsageStats() {
  return (
    <>
      <p className="text-lg font-bold text-zinc-900 sm:text-xl">Über 1.500 Betriebe nutzen bereits {siteConfig.name}.</p>
      <div className="mx-auto mt-5 inline-flex w-full max-w-md flex-col items-center rounded-2xl border-2 border-zinc-900 bg-white px-10 py-7 shadow-lg">
        <span className="text-sm font-medium text-zinc-500">Für Betriebe erledigte Anfragen</span>
        <span className="mt-2 text-4xl font-black tracking-tight text-zinc-900 tabular-nums sm:text-5xl">126.789</span>
      </div>
    </>
  );
}
