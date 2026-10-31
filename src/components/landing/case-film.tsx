"use client";

import { AlertCircle, Bell, CalendarCheck, Check, CheckCircle2, Circle, FileText, Inbox, Mail, Pause, Play, RotateCcw, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { siteConfig } from "@/lib/config/site";
import { DEFAULT_FILM, type FilmScenario } from "./film-scenario";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------------------------------
 * "Film" auf der Startseite: Ein kompletter Fall in ~26 Sekunden, links das Postfach, rechts die
 * entstehende Fallakte. Alles reines HTML/CSS (kein Video-File) – scharf auf jedem Bildschirm, leicht,
 * barrierearm (pausiert außerhalb des Sichtbereichs, respektiert "Bewegung reduzieren").
 * ------------------------------------------------------------------------------------------------- */

const SCENES = [
  { start: 0, title: "Kundenmail kommt rein", text: "Eine ganz normale Anfrage landet in Ihrem Postfach." },
  { start: 4200, title: "KI erkennt die Angaben", text: "Leistung, Dach, Schadensfläche & Co. wandern automatisch in die Fallakte." },
  { start: 8200, title: "Antwort mit Ihrer Vorlage", text: "Ihre eigene Nachricht samt PDF-Formular – und was noch fehlt." },
  { start: 12600, title: "Unterlagen kommen zurück", text: "Formular und Fotos: geprüft, ausgelesen, abgelegt." },
  { start: 16800, title: "Fall fertig – Termin steht", text: "Sie bekommen Bescheid und bestätigen nur noch den Termin." },
  { start: 21600, title: "Fragen beantworten Sie", text: "Fragt ein Kunde nach dem Preis, antwortet nicht die KI – sondern Sie." },
] as const;
const TOTAL = 26500;
/** Benachrichtigungen liegen übereinander an derselben Stelle (oben rechts bzw. am Desktop unten links im Postfach). */
const TOAST = "absolute inset-x-0 top-0 md:top-auto md:bottom-0";
const TICK = 50;

/** 0…1 – wie weit ein Abschnitt [start, start+dur] fortgeschritten ist. */
const progress = (t: number, start: number, dur: number) => Math.min(1, Math.max(0, (t - start) / dur));
/** Schreibmaschinen-Effekt. */
const typed = (text: string, t: number, start: number, dur: number) => text.slice(0, Math.round(text.length * progress(t, start, dur)));

function Reveal({ show, children, className, from = "up" }: { show: boolean; children: ReactNode; className?: string; from?: "up" | "left" | "right" | "scale" }) {
  const hidden = { up: "translate-y-3", left: "-translate-x-6", right: "translate-x-6", scale: "scale-90" }[from];
  return <div className={cn("transition-all duration-500 ease-out", show ? "translate-x-0 translate-y-0 scale-100 opacity-100" : cn("pointer-events-none opacity-0", hidden), className)}>{children}</div>;
}

function Chip({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "success" | "warning"; className?: string }) {
  const tones = {
    neutral: "bg-muted text-muted-foreground",
    accent: "bg-accent-soft text-accent",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
  } as const;
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors duration-500", tones[tone], className)}>{children}</span>;
}

/* ------------------------------------ Inhalte des Films ------------------------------------ */

/* ------------------------------------------ Film ------------------------------------------ */

export function CaseFilm({ scenario = DEFAULT_FILM }: { scenario?: FilmScenario } = {}) {
  const sc = scenario;
  const MAIL_TEXT = sc.mailParts.map((p) => p.text).join("");
  /** Startposition jedes Textstücks im Gesamttext (für den Schreibmaschinen-Effekt mit Markierungen). */
  const MAIL_OFFSETS = sc.mailParts.map((_, i) => sc.mailParts.slice(0, i).reduce((n, p) => n + p.text.length, 0));
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setReduced(media.matches);
      if (media.matches) {
        setPlaying(false);
        setT(SCENES[4].start + 4000);
      }
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !inView) return;
    const id = setInterval(() => setT((v) => (v + TICK >= TOTAL ? 0 : v + TICK)), TICK);
    return () => clearInterval(id);
  }, [playing, inView]);

  const scene = SCENES.reduce((acc, s, i) => (t >= s.start ? i : acc), 0);
  const [s1, s2, s3, s4, s5, s6] = SCENES.map((s) => s.start);

  // --- abgeleiteter Zustand ---
  const mailText = typed(MAIL_TEXT, t, 900, 2800);
  const marksVisible = (i: number) => t >= s2 + 400 + i * 550;
  const fieldsVisible = (i: number) => t >= s2 + 700 + i * 550;
  const replyText = typed(sc.reply, t, s3 + 700, 2600);
  const replySent = t >= s3 + 3700;
  const docDone = (i: number) => t >= s4 + 1500 + i * 700;
  const formVisible = (i: number) => t >= s4 + 2200 + i * 600;
  const ready = t >= s5;
  const confirmed = t >= s5 + 3000;

  const fieldsShown = sc.fields.filter((_, i) => fieldsVisible(i)).length;
  const docsShown = t >= s3 + 2000;
  const docsDone = sc.docs.filter((_, i) => docDone(i)).length;
  const percent = !docsShown ? (fieldsShown ? 20 : 0) : Math.round(((docsDone + 1) / (sc.docs.length + 1)) * 100);
  const status = ready
    ? { label: "Bereit zur Prüfung", tone: "success" as const }
    : t >= s3 + 3700
      ? { label: "Wartet auf Kunde", tone: "warning" as const }
      : t >= s2
        ? { label: "KI fragt nach", tone: "accent" as const }
        : { label: "Neu", tone: "accent" as const };

  // Linke Seite: welche Mail ist gerade "geöffnet"?
  const leftView = t < s3 ? "mail" : t < s4 ? "reply" : t < s6 ? "answer" : "question";
  const inSceneSix = t >= s6;
  // Am Handy ist nur Platz für eine Seite: Fallakte zeigen, wenn dort gerade etwas passiert, sonst das Postfach.
  const mobilePanel: "mail" | "case" = (t >= s2 + 1500 && t < s3) || (t >= s4 && t < s6) ? "case" : "mail";

  const jump = (i: number) => {
    setT(SCENES[i].start);
    if (!reduced) setPlaying(true);
  };

  return (
    <div ref={rootRef} className="mx-auto max-w-5xl">
      <div
        className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-black/10"
        role="img"
        aria-label="Animierter Ablauf: Eine Kundenmail kommt rein, FallFlow erkennt die Angaben, antwortet mit Vorlage, sammelt die Unterlagen ein und bereitet den Fall samt Terminvorschlag vor. Fragen von Kunden beantwortet das Büro selbst."
      >
        {/* Fensterleiste */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
          </span>
          <span className="ml-2 truncate text-xs font-medium text-muted-foreground">{siteConfig.name} · {sc.office}</span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", playing && inView ? "animate-pulse bg-danger" : "bg-muted-foreground/40")} aria-hidden />
            {playing && inView ? "live" : "pausiert"}
          </span>
        </div>

        {/* Benachrichtigungen (oben rechts) */}
        <div className="pointer-events-none absolute top-14 right-3 z-20 w-64 sm:right-4 sm:w-72 md:top-auto md:right-auto md:bottom-28 md:left-5">
          <Reveal show={t >= 300 && t < s2 + 600} from="right" className={TOAST}>
            <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-card/95 p-3 text-xs shadow-lg backdrop-blur">
              <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">Neue E-Mail</p>
                <p className="text-muted-foreground">{sc.customer} · {sc.subject}</p>
              </div>
            </div>
          </Reveal>
          <Reveal show={t >= s5 + 900 && t < s6} from="right" className={TOAST}>
            <div className="flex items-start gap-2.5 rounded-2xl border border-success/30 bg-card/95 p-3 text-xs shadow-lg backdrop-blur">
              <Bell className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <div>
                <p className="font-semibold">FallFlow: Fall bereit zur Prüfung</p>
                <p className="text-muted-foreground">{sc.customer} ({sc.service}) – Termin bitte bestätigen</p>
              </div>
            </div>
          </Reveal>
          <Reveal show={t >= s6 + 2600} from="right" className={TOAST}>
            <div className="flex items-start gap-2.5 rounded-2xl border border-warning/40 bg-card/95 p-3 text-xs shadow-lg backdrop-blur">
              <Bell className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <div>
                <p className="font-semibold">{siteConfig.name}: {sc.question.from} wartet auf Ihre Antwort</p>
                <p className="text-muted-foreground">Frage zum Preis – die KI antwortet nicht selbst.</p>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="flex gap-1.5 border-b border-border px-4 py-2 md:hidden" aria-hidden>
          {(["mail", "case"] as const).map((k) => (
            <span key={k} className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors duration-300", mobilePanel === k ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>
              {k === "mail" ? "Postfach" : "Fallakte"}
            </span>
          ))}
        </div>
        <div className="grid md:grid-cols-[1.15fr_1fr]">
          {/* ---------------- Links: Postfach ---------------- */}
          <div className={cn("relative h-[24rem] overflow-hidden p-4 sm:h-[24rem] sm:p-5 md:h-[25rem] md:border-r", mobilePanel !== "mail" && "max-md:hidden")}>
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground">
              <Inbox className="size-3.5" aria-hidden /> POSTEINGANG
            </p>

            {/* Szene 1+2: Kundenmail */}
            <div className={cn("absolute inset-x-4 top-11 transition-all duration-500 sm:inset-x-5", leftView === "mail" ? "opacity-100" : "pointer-events-none -translate-x-4 opacity-0")}>
              <MailCard from={`${sc.customer} <${sc.email}>`} subject={sc.subject} show={t >= 600}>
                <p className="relative leading-relaxed">
                  {sc.mailParts.map((part, i) => {
                      const piece = part.text.slice(0, Math.max(0, mailText.length - MAIL_OFFSETS[i]));
                      if (!piece) return null;
                      return part.mark === undefined ? (
                        <span key={i}>{piece}</span>
                      ) : (
                        <mark key={i} className={cn("-mx-0.5 rounded px-0.5 transition-colors duration-500", marksVisible(part.mark) ? "bg-accent text-white" : "bg-transparent text-inherit")}>
                          {piece}
                        </mark>
                      );
                    })}
                  {t < 3700 && t >= 900 && <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-foreground" aria-hidden />}
                </p>
                {/* Scan-Linie, während die KI liest */}
                <span
                  className={cn("pointer-events-none absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-accent/10 to-transparent transition-opacity duration-300", t >= s2 && t < s2 + 3200 ? "opacity-100" : "opacity-0")}
                  style={{ top: `${progress(t, s2, 3200) * 85}%` }}
                  aria-hidden
                />
              </MailCard>
              <Reveal show={t >= s2 + 300} className="mt-3">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <Sparkles className="size-3.5" aria-hidden /> FallFlow liest mit und erkennt die Angaben …
                </p>
              </Reveal>
            </div>

            {/* Szene 3: Antwort */}
            <div className={cn("absolute inset-x-4 top-11 transition-all duration-500 sm:inset-x-5", leftView === "reply" ? "opacity-100" : leftView === "mail" ? "pointer-events-none translate-x-4 opacity-0" : "pointer-events-none -translate-x-4 opacity-0")}>
              <div className="rounded-2xl border border-accent/30 bg-accent-soft/40 p-4 text-[13px] shadow-sm">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                  <Sparkles className="size-3.5" aria-hidden /> Antwort von FallFlow · in Ihrem Namen
                </p>
                <p className="mb-2 text-xs text-muted-foreground">An: {sc.email} · Betreff: Ihre Anfrage zur {sc.service}</p>
                <p className="min-h-[5.5rem] leading-relaxed">
                  {replyText}
                  {!replySent && t >= s3 + 700 && <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-foreground" aria-hidden />}
                </p>
                <Reveal show={t >= s3 + 2900} from="scale" className="mt-2 inline-block">
                  <Chip tone="neutral" className="bg-card ring-1 ring-border">
                    <FileText className="size-3" aria-hidden /> {sc.template}.pdf
                  </Chip>
                </Reveal>
                <div className="mt-3 flex items-center justify-end">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-500", replySent ? "bg-success text-white" : "bg-accent text-white")}>
                    {replySent ? <Check className="size-3.5" aria-hidden /> : <Send className="size-3.5" aria-hidden />}
                    {replySent ? "Gesendet" : "Wird gesendet …"}
                  </span>
                </div>
              </div>
            </div>

            {/* Szene 4+5: Kundin antwortet mit Unterlagen */}
            <div className={cn("absolute inset-x-4 top-11 transition-all duration-500 sm:inset-x-5", leftView === "answer" ? "opacity-100" : leftView === "question" ? "pointer-events-none -translate-x-4 opacity-0" : "pointer-events-none translate-x-4 opacity-0")}>
              <MailCard from={`${sc.customer} <${sc.email}>`} subject={`Re: Ihre Anfrage zur ${sc.service}`} show={t >= s4 + 200}>
                <p className="leading-relaxed">{typed("Hallo, anbei alles Gewünschte. Viele Grüße!", t, s4 + 400, 900)}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {sc.attachments.map((f, i) => (
                    <Reveal key={f} show={t >= s4 + 900 + i * 250} from="scale" className="inline-block">
                      <Chip tone={docDone(i) ? "success" : "neutral"} className={cn(!docDone(i) && "bg-card ring-1 ring-border")}>
                        {docDone(i) ? <Check className="size-3" aria-hidden /> : <FileText className="size-3" aria-hidden />} {f}
                      </Chip>
                    </Reveal>
                  ))}
                </div>
              </MailCard>
              <Reveal show={t >= s5 + 300} className="mt-3">
                <div className="rounded-2xl border border-border bg-card p-3 text-[13px] shadow-sm">
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    <Sparkles className="size-3.5" aria-hidden /> Automatische Antwort an die Kundin
                  </p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    {typed("Vielen Dank, damit haben wir alle Angaben. Wir haben bereits einen passenden Termin für Sie vorbereitet …", t, s5 + 500, 1800)}
                  </p>
                </div>
              </Reveal>
            </div>

            {/* Szene 6: Frage eines anderen Kunden */}
            <div className={cn("absolute inset-x-4 top-11 transition-all duration-500 sm:inset-x-5", leftView === "question" ? "opacity-100" : "pointer-events-none translate-x-4 opacity-0")}>
              <MailCard from={`${sc.question.from} <kunde@beispiel.de>`} subject={sc.question.subject} show={inSceneSix}>
                <p className="leading-relaxed">
                  {typed(sc.question.text, t, s6 + 300, 900)}
                  <mark className={cn("-mx-0.5 rounded px-0.5 transition-colors duration-500", t >= s6 + 1800 ? "bg-warning-soft text-warning" : "bg-transparent text-inherit")}>
                    {typed(sc.question.ask, t, s6 + 1200, 600)}
                  </mark>
                </p>
              </MailCard>
              <Reveal show={t >= s6 + 2100} className="mt-3">
                <div className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning-soft p-3 text-[13px] text-warning">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <p>
                    <span className="font-semibold">Aufmerksamkeit benötigt.</span> Bei Preisfragen antwortet die KI bewusst nicht – die Mail liegt für Sie im Posteingang bereit.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>

          {/* ---------------- Rechts: Fallakte ---------------- */}
          <div className={cn("relative h-[24rem] overflow-hidden bg-background/60 p-4 sm:h-[24rem] sm:p-5 md:h-[25rem]", mobilePanel !== "case" && "max-md:hidden")}>
            <div className={cn("transition-all duration-500", inSceneSix ? "pointer-events-none scale-[0.97] opacity-0" : "opacity-100")}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground">FALLAKTE</p>
                <Chip tone={status.tone}>{status.label}</Chip>
              </div>
              <p className={cn("mt-2 text-lg font-semibold transition-opacity duration-500", t >= 1500 ? "opacity-100" : "opacity-0")}>{sc.customer}</p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {sc.fields.map(([k, v], i) => (
                  <Reveal key={k} show={fieldsVisible(i)} from="left" className="inline-block">
                    <Chip tone="neutral" className="bg-card ring-1 ring-border">
                      <span className="text-muted-foreground">{k}:</span> <span className="text-foreground">{v}</span>
                    </Chip>
                  </Reveal>
                ))}
              </div>
              <div className="mt-2 space-y-1">
                {sc.formFields.map(([k, v], i) => (
                  <Reveal key={k} show={formVisible(i)} from="left">
                    <p className="text-xs">
                      <span className="text-muted-foreground">{k}: </span>
                      <span className="font-medium">{v}</span>
                    </p>
                  </Reveal>
                ))}
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Vollständigkeit</span>
                  <span className="font-semibold tabular-nums">{percent} %</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full transition-all duration-700 ease-out", percent >= 100 ? "bg-success" : "bg-accent")} style={{ width: `${percent}%` }} />
                </div>
              </div>

              <ul className="mt-3 space-y-1.5 text-[13px]">
                {sc.docs.map((d, i) => (
                  <Reveal key={d} show={docsShown} className="block" from="up">
                    <li className="flex items-center gap-2">
                      {docDone(i) ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <Circle className="size-4 text-muted-foreground/40" aria-hidden />}
                      <span className={cn(!docDone(i) && "text-muted-foreground")}>{d}</span>
                      {!docDone(i) && replySent && <Chip tone="warning">angefordert</Chip>}
                    </li>
                  </Reveal>
                ))}
              </ul>

              <Reveal show={ready} className="mt-3" from="up">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-2.5 text-xs">
                  <span className="flex items-center gap-1.5">
                    <CalendarCheck className="size-4" aria-hidden />
                    <span>
                      <span className="font-semibold">Mo, 09:00 Uhr</span> <span className="text-muted-foreground">· Terminvorschlag</span>
                    </span>
                  </span>
                  <span className={cn("rounded-full px-2.5 py-1 font-semibold transition-all duration-300", confirmed ? "bg-success text-white" : t >= s5 + 2500 ? "scale-95 bg-accent text-white" : "bg-accent text-white")}>
                    {confirmed ? "Bestätigt ✓" : "Bestätigen"}
                  </span>
                </div>
              </Reveal>
              <Reveal show={confirmed} className="mt-1.5">
                <p className="text-xs font-medium text-success">Terminbestätigung automatisch an die Kundin geschickt.</p>
              </Reveal>
            </div>

            {/* Szene 6 rechts: Posteingang-Hinweis */}
            <div className={cn("absolute inset-4 transition-all duration-500 sm:inset-5", inSceneSix ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0")}>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground">POSTEINGANG</p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-warning bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning">
                <AlertCircle className="size-3.5" aria-hidden /> Aufmerksamkeit benötigt ({t >= s6 + 2100 ? 1 : 0})
              </div>
              <Reveal show={t >= s6 + 2100} className="mt-3">
                <div className="rounded-2xl border border-border bg-card p-3 text-[13px] shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{sc.question.from}</p>
                    <Chip tone="warning">Ihre Antwort nötig</Chip>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Frage des Kunden: {sc.question.ask}</p>
                </div>
              </Reveal>
              <Reveal show={t >= s6 + 3400} className="mt-3">
                <p className="text-xs leading-relaxed text-muted-foreground">Sie antworten persönlich – direkt in FallFlow oder in Ihrem E-Mail-Programm. Danach läuft alles wieder automatisch.</p>
              </Reveal>
            </div>
          </div>
        </div>

        {/* Untertitel + Steuerung */}
        <div className="border-t border-border bg-card px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover"
              aria-label={playing ? "Pause" : "Abspielen"}
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                <span className="text-muted-foreground tabular-nums">{scene + 1}/6 · </span>
                {SCENES[scene].title}
              </p>
              <p className="line-clamp-2 text-xs text-muted-foreground sm:truncate">{scene === 1 ? sc.recognizes : SCENES[scene].text}</p>
            </div>
            <button type="button" onClick={() => jump(0)} className="hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted sm:flex">
              <RotateCcw className="size-3.5" aria-hidden /> Von vorn
            </button>
          </div>
          {/* Szenen-Leiste wie bei einem Video */}
          <div className="mt-3 flex gap-1.5" role="group" aria-label="Szene wählen">
            {SCENES.map((s, i) => {
              const end = SCENES[i + 1]?.start ?? TOTAL;
              const fill = progress(t, s.start, end - s.start);
              return (
                <button key={s.title} type="button" onClick={() => jump(i)} className="group flex-1 py-1.5" aria-label={`Szene ${i + 1}: ${s.title}`} aria-current={i === scene ? "step" : undefined}>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-muted group-hover:bg-border">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${fill * 100}%` }} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MailCard({ from, subject, show, children }: { from: string; subject: string; show: boolean; children: ReactNode }) {
  return (
    <Reveal show={show}>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 text-[13px] shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{from.charAt(0)}</span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">{from}</p>
            <p className="truncate text-xs text-muted-foreground">{subject}</p>
          </div>
        </div>
        {children}
      </div>
    </Reveal>
  );
}
