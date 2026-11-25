import type { Metadata } from "next";
import { Article, H2, Template } from "@/components/landing/article";

const PATH = "/ratgeber/antwort-auf-kundenanfrage-muster";
const TITLE = "Antwort auf eine Kundenanfrage: Muster für Handwerker";
const INTRO =
  "Eine schnelle, freundliche Antwort entscheidet oft, wer den Auftrag bekommt. Hier finden Sie Vorlagen zum Kopieren – für Dachdecker, Maler, Sanitär und Heizung, Elektriker – plus eine kurze Eingangsbestätigung und eine freundliche Absage.";

export const metadata: Metadata = {
  title: "Antwort auf Kundenanfrage – Muster & Vorlagen für Handwerker",
  description: INTRO,
  alternates: { canonical: PATH },
};

export default function Page() {
  return (
    <Article path={PATH} title={TITLE} intro={INTRO} published="2026-11-25">
      <H2>Was in eine gute Antwort gehört</H2>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong>Dank und Bezug auf die Anfrage</strong> – der Kunde merkt, dass jemand seine Nachricht gelesen hat.
        </li>
        <li>
          <strong>Alle fehlenden Angaben auf einmal abfragen</strong> – nicht in drei Runden hin und her.
        </li>
        <li>
          <strong>Um Fotos bitten</strong> – das spart oft die erste Besichtigung oder macht sie kürzer.
        </li>
        <li>
          <strong>Sagen, wie es weitergeht</strong> – z. B. „Sobald alles da ist, melden wir uns mit einem Terminvorschlag.“
        </li>
        <li>
          <strong>Keine Preise aus dem Bauch heraus</strong> – lieber erst die Angaben, dann ein sauberes Angebot.
        </li>
      </ul>

      <H2>Muster: allgemeine Antwort</H2>
      <Template title="Betreff: Ihre Anfrage – vielen Dank">{`Guten Tag Frau Müller,

vielen Dank für Ihre Anfrage. Damit wir Ihnen ein passendes Angebot machen können, brauchen wir noch ein paar Angaben:

– die Adresse, an der gearbeitet werden soll
– ungefähr die Größe (z. B. Fläche in m²)
– zwei, drei Fotos der aktuellen Situation

Schicken Sie uns alles einfach als Antwort auf diese E-Mail. Sobald die Angaben da sind, melden wir uns mit einem Terminvorschlag.

Viele Grüße
Ihr Name
Firmenname · Telefon`}</Template>

      <H2>Muster für Dachdecker</H2>
      <Template title="Betreff: Ihre Anfrage zur Dachreparatur">{`Guten Tag Herr Weber,

vielen Dank für Ihre Nachricht – ärgerlich, wenn nach einem Sturm Ziegel fehlen. Damit wir den Schaden einschätzen können, schicken Sie uns bitte noch:

– die Adresse des Gebäudes
– die Dachform (z. B. Satteldach, Flachdach)
– ungefähr, wie groß die betroffene Stelle ist
– Fotos vom Schaden, gern auch vom Boden aus

Kommt bereits Wasser ins Haus, rufen Sie uns bitte direkt an: Telefonnummer.

Viele Grüße
Ihr Name`}</Template>

      <H2>Muster für Maler</H2>
      <Template title="Betreff: Ihre Anfrage – Wohnung streichen">{`Guten Tag Frau Schneider,

vielen Dank für Ihre Anfrage, Ihre Wohnung neu streichen zu lassen. Für ein passendes Angebot brauchen wir noch:

– die Adresse und das Stockwerk
– welche Räume (und ob Decken mitgestrichen werden sollen)
– ungefähr die Wohnfläche
– Ihren Farbwunsch (gern auch „wie bisher“)
– ein paar Fotos der Räume

Sobald alles da ist, schicken wir Ihnen einen Vorschlag für einen Besichtigungstermin.

Viele Grüße
Ihr Name`}</Template>

      <H2>Muster für Sanitär und Heizung</H2>
      <Template title="Betreff: Ihre Anfrage zur Badsanierung">{`Guten Tag Herr Yilmaz,

vielen Dank für Ihre Anfrage zur Badsanierung. Damit wir planen können, schicken Sie uns bitte:

– die Adresse
– die ungefähre Größe des Bades
– was erneuert werden soll (z. B. Dusche statt Wanne, Fliesen, WC)
– Fotos vom jetzigen Bad

Bei einem Heizungsausfall oder Wasserschaden erreichen Sie uns am schnellsten telefonisch unter Telefonnummer.

Viele Grüße
Ihr Name`}</Template>

      <H2>Muster für Elektriker</H2>
      <Template title="Betreff: Ihre Anfrage zur Wallbox">{`Guten Tag Frau Becker,

vielen Dank für Ihre Anfrage zur Installation einer Wallbox. Für ein Angebot brauchen wir noch:

– die Adresse
– wo die Wallbox hin soll (Garage, Carport, Außenwand)
– ungefähr die Entfernung zum Zählerschrank
– ein Foto vom Zählerschrank und vom gewünschten Platz

Danach melden wir uns mit einem Angebot bzw. einem Termin vor Ort.

Viele Grüße
Ihr Name`}</Template>

      <H2>Kurze Eingangsbestätigung, wenn gerade keine Zeit ist</H2>
      <p>Besser eine kurze Antwort heute als eine lange in einer Woche. Kunden fragen oft mehrere Betriebe an – wer zuerst reagiert, ist im Rennen.</p>
      <Template title="Betreff: Ihre Anfrage ist angekommen">{`Guten Tag,

vielen Dank für Ihre Nachricht – sie ist bei uns angekommen. Wir sind gerade auf der Baustelle und melden uns bis spätestens übermorgen bei Ihnen.

Viele Grüße
Ihr Name`}</Template>

      <H2>Freundliche Absage</H2>
      <p>Auch eine Absage ist besser als keine Antwort – der Kunde kann sich dann gleich anderswo umsehen und behält Sie in guter Erinnerung.</p>
      <Template title="Betreff: Ihre Anfrage">{`Guten Tag Herr Klein,

vielen Dank für Ihre Anfrage. Leider sind wir in den nächsten Wochen voll ausgelastet und können Ihren Auftrag nicht zeitnah übernehmen. Wir wünschen Ihnen viel Erfolg bei der Suche und melden uns gern, wenn Sie später noch einmal anfragen möchten.

Viele Grüße
Ihr Name`}</Template>
    </Article>
  );
}
