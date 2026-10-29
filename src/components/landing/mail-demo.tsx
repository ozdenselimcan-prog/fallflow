"use client";

import { AlertCircle, ArrowRight, CalendarCheck, CheckCircle2, Circle, Inbox, Paperclip, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "success" | "warning";

interface Mail {
  from: "customer" | "ai";
  sender: string;
  text: string;
  attachments?: string[];
}

interface CaseView {
  status: { label: string; tone: Tone };
  percent: number;
  fields: [string, string][];
  checklist: { label: string; done: boolean }[];
  note?: { tone: "success" | "warning" | "neutral"; text: string };
}

interface Step {
  mail: Mail | null;
  /** Kurzer Hinweis, was FallFlow in diesem Schritt macht. */
  action: string;
  case: CaseView | null;
}

const CUSTOMER = "Erika Beispiel <erika@beispiel.de>";
const OFFICE = "Muster Bedachungen (FallFlow)";

const base: [string, string][] = [
  ["Leistung", "Dachreparatur"],
  ["Name", "Erika Beispiel"],
  ["Schaden", "Satteldach, ca. 10 m² Ziegel fehlen"],
];
const withForm: [string, string][] = [...base, ["Adresse", "Lindenweg 7, 82166 Gräfelfing"], ["Wassereintritt", "nein"], ["Aus dem Formular", "Zugang über Garten · Gerüst möglich"]];

const SCENARIOS: { id: string; label: string; steps: Step[] }[] = [
  {
    id: "anfrage",
    label: "Normale Anfrage",
    steps: [
      {
        mail: { from: "customer", sender: CUSTOMER, text: "Guten Tag, nach dem Sturm fehlen auf unserem Satteldach einige Ziegel, ca. 10 m². Wir bitten um eine Dachreparatur. Viele Grüße, Erika Beispiel" },
        action: "Mail geht ein – die KI erkennt Kundenanfrage, Leistung und Angaben und legt die Fallakte an.",
        case: { status: { label: "Neu", tone: "accent" }, percent: 0, fields: base, checklist: [] },
      },
      {
        mail: {
          from: "ai",
          sender: OFFICE,
          text: "Vielen Dank für Ihre Anfrage zur Dachreparatur. Im Anhang finden Sie unser Auftragsformular – bitte ausfüllen und einfach als Antwort auf diese E-Mail zurücksenden.\n\nDamit wir Ihre Anfrage bearbeiten können, schicken Sie uns bitte außerdem: Fotos vom Schaden, Foto der Hausansicht – gern einfach mit dem Handy fotografiert.",
          attachments: ["Auftragsformular.pdf"],
        },
        action: "Die KI antwortet mit Ihrer Nachricht zur Leistung und Ihrer PDF-Vorlage – und sagt, welche Unterlagen noch fehlen.",
        case: {
          status: { label: "Wartet auf Kunde", tone: "warning" },
          percent: 0,
          fields: base,
          checklist: [
            { label: "Auftragsformular (ausgefüllt)", done: false },
            { label: "Fotos vom Schaden", done: false },
            { label: "Hausansicht", done: false },
          ],
        },
      },
      {
        mail: { from: "customer", sender: CUSTOMER, text: "Hallo, anbei das ausgefüllte Formular und die Fotos vom Schaden.", attachments: ["Auftragsformular_ausgefuellt.pdf", "Schaden_1.jpg", "Schaden_2.jpg"] },
        action: "Die KI prüft das Formular, übernimmt die eingetragenen Angaben in die Fallakte und legt Formular und Fotos ab.",
        case: {
          status: { label: "Wartet auf Kunde", tone: "warning" },
          percent: 67,
          fields: withForm,
          checklist: [
            { label: "Auftragsformular (ausgefüllt)", done: true },
            { label: "Fotos vom Schaden", done: true },
            { label: "Hausansicht", done: false },
          ],
        },
      },
      {
        mail: { from: "ai", sender: OFFICE, text: "Vielen Dank, Ihre Unterlagen sind bei uns angekommen. Damit wir Ihre Anfrage abschließen können, fehlt uns noch: ein Foto der Hausansicht. Sie können es einfach als Antwort auf diese E-Mail schicken." },
        action: "Fehlt noch etwas, sagt die KI genau was – nicht mehr und nicht weniger.",
        case: null,
      },
      {
        mail: { from: "customer", sender: CUSTOMER, text: "Hier noch das Foto vom Haus.", attachments: ["Hausansicht.jpg"] },
        action: "Jetzt ist alles da.",
        case: {
          status: { label: "Bereit zur Prüfung", tone: "success" },
          percent: 100,
          fields: withForm,
          checklist: [
            { label: "Auftragsformular (ausgefüllt)", done: true },
            { label: "Fotos vom Schaden", done: true },
            { label: "Hausansicht", done: true },
          ],
          note: { tone: "success", text: "Termin vorgeschlagen: Montag, 09:00 Uhr – wartet auf Ihre Bestätigung im Kalender." },
        },
      },
      {
        mail: { from: "ai", sender: OFFICE, text: "Vielen Dank, damit haben wir alle Angaben. Wir haben bereits einen passenden Termin für Sie vorbereitet – ein Mitarbeiter bestätigt Ihnen den genauen Termin in Kürze." },
        action: "Fertig: Sie bestätigen nur noch den Termin – die Bestätigung geht automatisch an den Kunden.",
        case: null,
      },
    ],
  },
  {
    id: "frage",
    label: "Kunde stellt eine Frage",
    steps: [
      {
        mail: { from: "customer", sender: "Max Muster <max@beispiel.de>", text: "Hallo, wir möchten zwei Dachfenster einbauen lassen. Was kostet das bei Ihnen und wie lange dauert es?" },
        action: "Die KI erkennt eine echte Frage – darauf soll eine Person antworten, nicht die KI.",
        case: {
          status: { label: "Ihre Antwort nötig", tone: "warning" },
          percent: 0,
          fields: [
            ["Leistung", "Dachfenster"],
            ["Name", "Max Muster"],
          ],
          checklist: [],
          note: { tone: "warning", text: "Aufmerksamkeit benötigt: Frage des Kunden – Was kosten zwei Dachfenster und wie lange dauert es? Keine automatische Antwort, Sie antworten selbst." },
        },
      },
    ],
  },
  {
    id: "whatsapp",
    label: "Per WhatsApp",
    steps: [
      {
        mail: { from: "customer", sender: "WhatsApp · Jonas (+49 170 …)", text: "Hallo, nach dem Sturm tropft es bei uns durchs Dach. Können Sie vorbeikommen?" },
        action: "Nachricht kommt per WhatsApp – Name und Handynummer kennt FallFlow schon. Die KI fragt Schritt für Schritt, was auf Ihrer Seite „WhatsApp-Fragen“ steht.",
        case: { status: { label: "Wird qualifiziert", tone: "accent" }, percent: 25, fields: [["Leistung", "Dachreparatur"], ["Name", "Jonas"], ["Kanal", "WhatsApp"]], checklist: [] },
      },
      {
        mail: { from: "ai", sender: OFFICE, text: "Vielen Dank für Ihre Nachricht! Wie lautet die Adresse (Straße, Hausnummer, PLZ und Ort)?" },
        action: "Eine Frage nach der anderen – wie in einem normalen Chat.",
        case: null,
      },
      {
        mail: { from: "customer", sender: "WhatsApp · Jonas (+49 170 …)", text: "Lindenweg 7, 82166 Gräfelfing" },
        action: "Straße, PLZ und Ort werden getrennt in die Fallakte übernommen.",
        case: { status: { label: "Wird qualifiziert", tone: "accent" }, percent: 60, fields: [["Leistung", "Dachreparatur"], ["Name", "Jonas"], ["Adresse", "Lindenweg 7, 82166 Gräfelfing"]], checklist: [] },
      },
      {
        mail: { from: "ai", sender: OFFICE, text: "Danke! Dringt bereits Wasser ins Haus ein?" },
        action: "Die nächste Frage aus Ihrer Liste.",
        case: null,
      },
      {
        mail: { from: "customer", sender: "WhatsApp · Jonas (+49 170 …)", text: "Ja, ein bisschen auf dem Dachboden.", attachments: ["Foto_Dachboden.jpg"] },
        action: "Wasser dringt ein: FallFlow markiert den Fall sofort für Sie – das Foto liegt schon in der Fallakte.",
        case: {
          status: { label: "Aufmerksamkeit benötigt", tone: "warning" },
          percent: 100,
          fields: [["Leistung", "Dachreparatur"], ["Name", "Jonas"], ["Adresse", "Lindenweg 7, 82166 Gräfelfing"], ["Wassereintritt", "ja"]],
          checklist: [{ label: "Foto vom Schaden", done: true }],
          note: { tone: "warning", text: "Notfall: Wasser dringt ein – bitte melden Sie sich persönlich. Antworten Sie selbst im Chat, pausiert die KI dort." },
        },
      },
    ],
  },
  {
    id: "spam",
    label: "Rechnung / Werbung",
    steps: [
      {
        mail: { from: "customer", sender: "Baustoffhandel Schmidt <buchhaltung@baustoffe-schmidt.de>", text: "Sehr geehrte Damen und Herren, anbei unsere Rechnung Nr. 4711.", attachments: ["Rechnung_4711.pdf"] },
        action: "Keine Kundenanfrage – FallFlow ignoriert die Mail. Kein Fall, keine Antwort; sie bleibt einfach in Ihrem Postfach.",
        case: null,
      },
    ],
  },
];

/**
 * Landingpage-Demo des echten Ablaufs per E-Mail: Schritt für Schritt, was der Kunde schreibt, was die KI antwortet
 * und wie die Fallakte entsteht. Rein im Browser, feste Beispieldaten.
 */
export function MailDemo() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [shown, setShown] = useState(1);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const visible = scenario.steps.slice(0, shown);
  const current = [...visible].reverse().find((s) => s.case !== null)?.case ?? null;
  const finished = shown >= scenario.steps.length;
  const ignored = scenario.id === "spam";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Beispiel wählen">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === scenarioId}
            onClick={() => {
              setScenarioId(s.id);
              setShown(1);
            }}
            className={cn("rounded-full border px-3 py-1.5 text-sm", s.id === scenarioId ? "border-accent bg-accent-soft text-accent" : "border-border bg-card hover:bg-muted")}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">E-Mail-Verlauf</p>
            <span className="text-xs text-muted-foreground">Demo – keine echten Daten</span>
          </div>
          <ol className="flex-1 space-y-3 p-4">
            {visible.map((step, i) =>
              step.mail ? (
                <li key={i} className="ff-fade-in space-y-1.5">
                  <div className={cn("rounded-xl border p-3 text-sm", step.mail.from === "ai" ? "border-accent/30 bg-accent-soft/40" : "border-border bg-background")}>
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      {step.mail.from === "ai" && <Sparkles className="size-3 text-accent" aria-hidden />}
                      {step.mail.sender}
                    </p>
                    <p className="whitespace-pre-line leading-relaxed">{step.mail.text}</p>
                    {step.mail.attachments && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {step.mail.attachments.map((a) => (
                          <span key={a} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs">
                            <Paperclip className="size-3" aria-hidden /> {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="px-1 text-xs text-muted-foreground">↳ {step.action}</p>
                </li>
              ) : null,
            )}
          </ol>
          <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => setShown(1)} disabled={shown === 1}>
              <RotateCcw className="size-3.5" /> Neu starten
            </Button>
            {!finished && (
              <Button size="sm" onClick={() => setShown(shown + 1)}>
                Nächster Schritt <ArrowRight className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Fallakte im FallFlow-Dashboard</p>
          {ignored ? (
            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
              <Trash2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              Kein Fall angelegt – Rechnungen, Newsletter und Werbung sortiert FallFlow aus.
            </div>
          ) : current ? (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground">BERATUNGSFALL</span>
                <Badge tone={current.status.tone}>{current.status.label}</Badge>
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                {current.fields.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              {current.checklist.length > 0 && (
                <>
                  <div className="mt-4 mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Vollständigkeit</span>
                    <span className="font-semibold">{current.percent} %</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={current.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Vollständigkeit">
                    <div className={cn("h-full rounded-full transition-all duration-500", current.percent >= 100 ? "bg-success" : "bg-accent")} style={{ width: `${current.percent}%` }} />
                  </div>
                  <ul className="mt-3 space-y-1 text-sm">
                    {current.checklist.map((item) => (
                      <li key={item.label} className="flex items-center gap-2">
                        {item.done ? <CheckCircle2 className="size-4 text-success" aria-label="erhalten" /> : <Circle className="size-4 text-muted-foreground/50" aria-label="fehlt" />}
                        <span className={cn(!item.done && "text-muted-foreground")}>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {current.note && (
                <p className={cn("mt-4 flex items-start gap-2 rounded-xl px-3 py-2 text-sm", current.note.tone === "success" ? "bg-success-soft text-success" : current.note.tone === "warning" ? "bg-warning-soft text-warning" : "bg-muted")}>
                  {current.note.tone === "success" ? <CalendarCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
                  {current.note.text}
                </p>
              )}
            </div>
          ) : null}
          {scenario.id === "frage" && (
            <p className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning">
              <Inbox className="size-4 shrink-0" aria-hidden /> Posteingang: „Aufmerksamkeit benötigt (1)“
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Zusätzlich beantwortet der Website-Chat Fragen von Besuchern zu Ihren Leistungen – Anfragen und Termine verweist er an Ihre E-Mail-Adresse und Telefonnummer.
          </p>
        </div>
      </div>
    </div>
  );
}
