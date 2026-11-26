import type { Metadata } from "next";
import Link from "next/link";
import { Article, H2 } from "@/components/landing/article";

const PATH = "/ratgeber/ki-fuer-handwerker-vergleich";
const TITLE = "KI für Handwerker: Telefon-Assistent, Chatbot oder E-Mail-Automatik – was passt zu Ihrem Betrieb?";
const INTRO =
  "Überall wird KI fürs Handwerk angeboten – vom Telefon-Assistenten bis zur kompletten Betriebssoftware. Hier ein ehrlicher Überblick: was die einzelnen Arten von Werkzeugen können, wo ihre Grenzen liegen und welche für welchen Betrieb sinnvoll ist.";

export const metadata: Metadata = {
  title: "KI für Handwerker im Vergleich – Telefon, Chatbot, E-Mail",
  description: INTRO,
  alternates: { canonical: PATH },
};

const kategorien: { titel: string; was: string; gut: string; grenzen: string }[] = [
  {
    titel: "KI-Telefon-Assistent",
    was: "Nimmt Anrufe an, wenn Sie nicht rangehen, fragt das Nötigste ab und schickt Ihnen eine Zusammenfassung.",
    gut: "Betriebe, bei denen viele Anfragen telefonisch kommen und oft niemand abheben kann.",
    grenzen: "Kümmert sich um Anrufe, nicht um Ihr E-Mail-Postfach. Fotos, Maße oder Formulare kann man am Telefon nicht einsammeln. Abgerechnet wird meist nach Minuten oder Anrufen.",
  },
  {
    titel: "Handwerkersoftware mit KI-Funktionen",
    was: "Komplette Betriebssoftware für Angebote, Rechnungen, Aufmaß und Planung – KI-Funktionen kommen als Zusatz dazu.",
    gut: "Betriebe, die ohnehin ihre ganze Verwaltung digitalisieren wollen.",
    grenzen: "Bedeutet einen Programmwechsel und Einarbeitung fürs ganze Team. Wer nur keine Anfragen mehr verlieren will, kauft damit sehr viel mehr als nötig.",
  },
  {
    titel: "Website-Chatbot",
    was: "Ein Chatfenster auf Ihrer Website, das Fragen von Besuchern beantwortet.",
    gut: "Betriebe mit viel Besuch auf der eigenen Website.",
    grenzen: "Erreicht nur Kunden, die auf Ihrer Website schreiben. Die meisten Anfragen im Handwerk kommen aber per E-Mail, Telefon oder WhatsApp.",
  },
  {
    titel: "Allgemeiner KI-Schreibassistent fürs Postfach",
    was: "Schlägt Ihnen Antworten auf E-Mails vor, die Sie prüfen und abschicken.",
    gut: "Alle, die schneller formulieren möchten.",
    grenzen: "Kennt Ihr Handwerk nicht: fragt nicht gezielt nach Fotos und Maßen, vergibt keine Termine und behält nicht den Überblick, was beim Kunden noch fehlt. Sie müssen trotzdem jede Mail selbst anfassen.",
  },
  {
    titel: "Anfragen-Automatik für das E-Mail-Postfach",
    was: "Arbeitet direkt in Ihrem vorhandenen Postfach: beantwortet neue Anfragen mit Ihren Texten, fragt fehlende Angaben und Fotos nach, schlägt Termine vor und legt Ihnen den vorbereiteten Auftrag hin.",
    gut: "Kleine und mittlere Betriebe, die viele Anfragen per E-Mail (und WhatsApp) bekommen und keine Zeit für schnelle Antworten haben.",
    grenzen: "Nimmt keine Anrufe an. Lässt sich aber gut mit einem Telefon-Assistenten kombinieren, wenn der seine Zusammenfassungen per E-Mail schickt.",
  },
];

const fragen = [
  "Wie kommen die meisten Anfragen bei Ihnen an – Telefon, E-Mail, WhatsApp oder Website?",
  "Wollen Sie nur keine Anfragen mehr verlieren – oder Ihre ganze Verwaltung umstellen?",
  "Wer richtet das Werkzeug ein und pflegt es? Sie selbst, ein Mitarbeiter – oder der Anbieter?",
  "Wie wird abgerechnet: fester Monatspreis oder nach Minuten bzw. Anrufen? Gibt es eine Mindestlaufzeit?",
  "Erfindet die KI Preise oder Zusagen? Was passiert bei Notfällen und Reklamationen?",
  "Wo liegen die Daten Ihrer Kunden – und gibt es einen Vertrag zur Auftragsverarbeitung (AVV)?",
];

export default function Page() {
  return (
    <Article path={PATH} title={TITLE} intro={INTRO} published="2026-11-26">
      <H2>Die fünf Arten von KI-Werkzeugen im Überblick</H2>
      {kategorien.map((k) => (
        <section key={k.titel} className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold">{k.titel}</h3>
          <p className="mt-2">{k.was}</p>
          <p className="mt-3 text-[15px]">
            <strong>Passt für:</strong> {k.gut}
          </p>
          <p className="mt-1 text-[15px]">
            <strong>Grenzen:</strong> {k.grenzen}
          </p>
        </section>
      ))}

      <H2>Was kostet das ungefähr?</H2>
      <p>
        Die meisten Werkzeuge kosten zwischen etwa 30 und 200 € im Monat. Beim Telefon kommen oft Kosten pro Minute oder pro Anruf über ein Inklusivkontingent hinaus dazu,
        bei Betriebssoftware häufig eine längere Vertragslaufzeit. Vergleichen Sie deshalb nicht nur den Grundpreis, sondern was im Monat tatsächlich zusammenkommt.
      </p>

      <H2>Sechs Fragen, bevor Sie sich entscheiden</H2>
      <ol className="list-decimal space-y-2 pl-6">
        {fragen.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ol>

      <H2>Unsere Empfehlung</H2>
      <p>
        Fangen Sie dort an, wo heute die meisten Anfragen liegen bleiben. Kommen viele Anrufe, die niemand annimmt, ist ein Telefon-Assistent der erste Schritt. Liegen
        E-Mails tagelang unbeantwortet oder fehlen bei Anfragen ständig Fotos und Angaben, hilft eine Anfragen-Automatik fürs Postfach mehr. Beides lässt sich kombinieren.
      </p>
      <p>
        Egal wofür Sie sich entscheiden: Ein paar feste Abläufe helfen sofort – zum Beispiel{" "}
        <Link href="/ratgeber/antwort-auf-kundenanfrage-muster" className="font-medium underline underline-offset-2">
          Vorlagen für die erste Antwort
        </Link>{" "}
        und eine{" "}
        <Link href="/ratgeber/angaben-fuer-angebot-checkliste" className="font-medium underline underline-offset-2">
          Checkliste, welche Angaben Sie für ein Angebot brauchen
        </Link>
        .
      </p>
    </Article>
  );
}
