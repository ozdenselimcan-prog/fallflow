import { Star } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Bewertungen von Trustpilot – wortgleich übernommen (inkl. Schreibweise), nicht gekürzt oder verändert.
 * Neue Bewertungen hier ergänzen; nur echte Bewertungen von Nutzern, die FallFlow verwendet haben (§ 5b Abs. 3 UWG).
 */
const reviews = [
  {
    name: "Hian Kkk",
    date: "8. Oktober 2026",
    title: "Viel mehr Automatisierung und wenig Kosten",
    text: "Durch Fallflow konnten wir intern viel mehr automatisieren, es hat sich definitiv gelohnt. Der Preis ist da echt nicht zu übertreffen",
  },
  {
    name: "Kerim Tombulca",
    date: "17. Oktober 2026",
    title: "Alles",
    text: "Im Alltag als Energieberater gibt es genug zu tun. Da finde ich Lösungen wie Fallflow besonders interessant, weil sie dabei helfen können, wiederkehrende E-Mail-Aufgaben zu automatisieren. Ich durfte das Tool kostenlos testen und fand es richtig gut. Schaut es euch gerne selbst an!",
  },
  {
    name: "Vincent Safie",
    date: "15. Oktober 2026",
    title: "Energieberater",
    text: "Super Tool für Energieberater! Ich konnte Fallflow zwei Wochen kostenlos testen und bin sehr zufrieden. Besonders die E-Mail-Automatisierung finde ich interessant. Wer seine Arbeitsabläufe optimieren möchte, sollte sich Fallflow definitiv ansehen. 👍",
  },
  {
    name: "Christoph Kleve",
    date: "11. Oktober 2026",
    title: "Perfekt zum zeit sparen",
    text: "Ich habe fallflow 7 Tage kostenlos getestet und war begeistert durch die automatisierung der Mails. Ich muss mir keine Sorgen mehr machen Kundenanfragen hinterher zu laufen. Dank fallflow habe ich mehr zeit zum beraten und mehr zeit für andere dinge",
  },
  {
    name: "Domi",
    date: "10. Oktober 2026",
    title: "Ich durfte Fallflow zwei Wochen...",
    text: "Ich durfte Fallflow zwei Wochen kostenlos testen und bin wirklich begeistert. Gerade als Energieberater ist eine effiziente Kundenkommunikation sehr wichtig. Die Möglichkeit, E-Mails zu automatisieren, finde ich super und sehe darin großes Potenzial, im Arbeitsalltag Zeit zu sparen. Definitiv ein Tool, das man sich als Energieberater einmal anschauen sollte!",
  },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function Stars() {
  return (
    <span className="flex gap-0.5" aria-label="5 von 5 Sternen">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className="flex size-5 items-center justify-center bg-[#00b67a]">
          <Star className="size-3.5 fill-white text-white" aria-hidden />
        </span>
      ))}
    </span>
  );
}

export function ReviewsSection() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Das sagen Energieberater über FallFlow</h2>
        <ul className="-mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0">
          {reviews.map((r) => (
            <li key={r.name} className="w-[85%] shrink-0 snap-center md:w-auto">
              <Card className="flex h-full flex-col p-6">
                <Stars />
                <p className="mt-4 font-semibold">{r.title}</p>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{r.text}</p>
                <div className="mt-5 flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">{initials(r.name)}</span>
                  <span className="text-sm">
                    <span className="font-medium">{r.name}</span>
                    <span className="block text-xs text-muted-foreground">{r.date} · Trustpilot</span>
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-center text-xs text-muted-foreground md:hidden">← Wischen für weitere Bewertungen →</p>
        <div className="mt-8 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-xs text-muted-foreground">
            Unverändert übernommen von Trustpilot. Die Bewertungen stammen von Energieberatern, die FallFlow getestet haben bzw. nutzen.
          </p>
        </div>
      </div>
    </section>
  );
}
