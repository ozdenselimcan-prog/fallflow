"use client";

import { Check, Mail, Paperclip, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Bubble = { from: "customer" | "ai"; text: string; attachment?: string };

const EVENTS: { bubble: Bubble; percent: number }[] = [
  {
    bubble: {
      from: "customer",
      text: "Hallo, ich möchte eine Einzelmaßnahme (Heizungstausch) durchführen lassen.",
    },
    percent: 15,
  },
  {
    bubble: {
      from: "ai",
      text: "Vielen Dank für Ihre Anfrage! Notiert: Einzelmaßnahme – Heizungstausch. Wie groß ist die Wohnfläche und aus welchem Baujahr ist das Gebäude?",
    },
    percent: 15,
  },
  { bubble: { from: "customer", text: "140 m², Baujahr 1995." }, percent: 45 },
  {
    bubble: {
      from: "ai",
      text: "Danke! Es fehlen noch Ihr Name und eine Telefonnummer für Rückfragen.",
    },
    percent: 45,
  },
  {
    bubble: { from: "customer", text: "Markus Schmidt, 0151 2345678" },
    percent: 75,
  },
  {
    bubble: {
      from: "ai",
      text: "Perfekt. Für die Einzelmaßnahme benötigen wir noch die ausgefüllte EM-Vollmacht – Download- und Upload-Link anbei.",
    },
    percent: 75,
  },
  {
    bubble: {
      from: "customer",
      text: "Vollmacht ausgefüllt, hier ist sie.",
      attachment: "EM-Vollmacht_ausgefuellt.pdf",
    },
    percent: 95,
  },
  {
    bubble: {
      from: "ai",
      text: "Vielen Dank! Alle Angaben liegen vor – ein Mitarbeiter meldet sich in Kürze.",
    },
    percent: 100,
  },
];

const STEP_MS = 1600;
const HOLD_MS = 2800;
const RESET_PAUSE_MS = 900;

/** Automatisch ablaufende, in sich geschlossene Mail-Konversation: zeigt in Dauerschleife, wie der
 * Assistent aus einer ersten Kundenmail Schritt für Schritt eine vollständige Fallakte macht – inklusive
 * der automatisch verschickten Vorlage. Läuft ohne Interaktion, kommt also auch als "Kurzvideo" durch. */
export function MailFlowAnimation() {
  const [visible, setVisible] = useState(0);
  const [done, setDone] = useState(false);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useRef(false);

  // Nur abspielen, während das Element im sichtbaren Bereich ist (schont CPU/Akku beim Scrollen).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion.current) {
      setVisible(EVENTS.length);
      setDone(true);
      return;
    }
    if (!inView) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const run = (step: number) => {
      if (cancelled) return;
      if (step > EVENTS.length) {
        timer = setTimeout(() => {
          if (cancelled) return;
          setVisible(0);
          setDone(false);
          timer = setTimeout(() => run(1), RESET_PAUSE_MS);
        }, HOLD_MS);
        return;
      }
      setVisible(step);
      if (step === EVENTS.length) setDone(true);
      timer = setTimeout(() => run(step + 1), STEP_MS);
    };

    timer = setTimeout(() => run(1), 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [inView]);

  useEffect(() => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [visible]);

  const percent =
    visible === 0 ? 0 : EVENTS[Math.min(visible, EVENTS.length) - 1].percent;

  return (
    <div
      ref={rootRef}
      className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-black/5"
      role="img"
      aria-label="Animiertes Beispiel: Mail-Konversation, bei der der Assistent automatisch alle fehlenden Angaben einsammelt"
    >
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
        <Mail className="size-4 text-muted-foreground" aria-hidden />
        <span className="text-xs font-medium text-muted-foreground">
          Posteingang · info@mustermann-energie.de
        </span>
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <span
            className={cn(
              "size-1.5 rounded-full",
              done ? "bg-success" : "bg-accent animate-pulse",
            )}
          />
          {done ? "Fall vollständig" : "live"}
        </span>
      </div>

      <div
        ref={containerRef}
        className="flex h-72 flex-col gap-2.5 overflow-y-auto px-4 py-4 sm:h-80"
      >
        {EVENTS.slice(0, visible).map((e, i) => (
          <div
            key={i}
            className={cn(
              "ff-fade-in flex",
              e.bubble.from === "customer" ? "justify-start" : "justify-end",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                e.bubble.from === "customer"
                  ? "rounded-bl-sm bg-muted text-foreground"
                  : "rounded-br-sm bg-accent text-white",
              )}
            >
              {e.bubble.from === "ai" && (
                <span className="mb-1 flex items-center gap-1 text-xs font-medium text-white/80">
                  <Sparkles className="size-3" /> FallFlow-Assistent
                </span>
              )}
              {e.bubble.text}
              {e.bubble.attachment && (
                <span className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-background/20 px-2 py-1 text-xs">
                  <Paperclip className="size-3" /> {e.bubble.attachment}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-4 py-3.5">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Vollständigkeit der Fallakte
          </span>
          <span className="font-semibold">{percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        {done && (
          <div className="ff-fade-in mt-2.5 flex items-center gap-1.5 text-xs font-medium text-success">
            <Check className="size-3.5" /> Ohne manuelles Nachfragen – bereit
            zur Übergabe
          </div>
        )}
      </div>
    </div>
  );
}
