"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { apiFetch } from "@/lib/use-api";
import { cn } from "@/lib/utils";

type Choice = "yes" | "no" | "other";
interface Answer {
  choice: Choice;
  text?: string;
  extra?: string;
}
interface Question {
  id: string;
  group: string;
  question: string;
  hint: string;
  otherPlaceholder: string;
  extra: { label: string; placeholder: string } | null;
  answer: Answer;
}

/** Diese Punkte fragt schon das Einrichtungs-Gespräch (Gebiet, Ton, Anrede, Grußformel) – hier nicht noch einmal. */
const ASKED_IN_INTERVIEW = ["area", "short", "greeting", "signoff"];

/**
 * Einstellungen in der Einrichtung: die Fragen aus config/setup-questions.ts einzeln, mit großen Knöpfen. Ja/Nein springt
 * automatisch weiter; braucht „Ja“ eine Angabe (z. B. Preise) oder wird „Sonstiges“ gewählt, erscheint ein Feld.
 * Jede Antwort wird sofort gespeichert (wie unter KI-Assistent → Fragebogen).
 */
export function SetupSteps({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ questions: Question[] }>("GET", "/api/setup-questions")
      .then((r) => setQuestions(r.questions.filter((q) => !ASKED_IN_INTERVIEW.includes(q.id))))
      .catch(() => setError("Fragen konnten nicht geladen werden."));
  }, []);

  if (error && !questions) return <Notice tone="error">{error}</Notice>;
  if (!questions) return <p className="text-sm text-muted-foreground">Fragen werden geladen …</p>;

  const q = questions[index];
  const total = questions.length;
  const go = (i: number) => {
    const target = questions[i];
    setDraft(target ? (target.answer.choice === "other" ? (target.answer.text ?? "") : (target.answer.extra ?? "")) : "");
    setError(null);
    if (i >= total) onDone();
    else if (i < 0) onBack();
    else setIndex(i);
  };

  const save = async (answer: Answer, advance: boolean) => {
    setQuestions((qs) => qs?.map((x) => (x.id === q.id ? { ...x, answer } : x)) ?? qs);
    const needsText = (answer.choice === "other" && !answer.text?.trim()) || (answer.choice === "yes" && q.extra && !answer.extra?.trim());
    if (needsText) return; // erst speichern, wenn etwas eingetippt ist
    setPending(true);
    setError(null);
    try {
      await apiFetch("POST", "/api/setup-questions", { id: q.id, ...answer });
      if (advance) go(index + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setPending(false);
    }
  };

  const showInput = q.answer.choice === "other" || (q.answer.choice === "yes" && Boolean(q.extra));
  const choose = (choice: Choice) => {
    if (choice === "other" || (choice === "yes" && q.extra)) {
      const keep = choice === "yes" ? (q.answer.extra ?? "") : (q.answer.text ?? "");
      setDraft(keep);
      void save(choice === "yes" ? { choice, extra: keep } : { choice, text: keep }, false);
      return;
    }
    void save({ choice }, true);
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>
            Einstellung {index + 1} von {total}
          </span>
          <span>{q.group}</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-balance">{q.question}</h1>
      {q.hint && <p className="mt-2 text-sm text-muted-foreground">{q.hint}</p>}
      <div className="mt-6 grid grid-cols-3 gap-2" role="group" aria-label={q.question}>
        {(
          [
            ["yes", "Ja"],
            ["no", "Nein"],
            ["other", "Sonstiges"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            disabled={pending}
            aria-pressed={q.answer.choice === id}
            onClick={() => choose(id)}
            className={cn(
              "h-14 rounded-xl border text-base font-semibold transition-colors disabled:opacity-60",
              q.answer.choice === id ? "border-accent bg-accent text-white" : "border-border bg-card hover:border-accent/50",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {showInput && (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void save(q.answer.choice === "other" ? { choice: "other", text: draft } : { choice: "yes", extra: draft }, true);
          }}
        >
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={q.answer.choice === "other" ? q.otherPlaceholder : q.extra?.placeholder}
            aria-label={q.answer.choice === "other" ? "Ihre Antwort" : q.extra?.label}
            className="flex-1"
          />
          <Button type="submit" disabled={!draft.trim()} loading={pending}>
            Übernehmen
          </Button>
        </form>
      )}
      {error && <Notice tone="error" className="mt-4">{error}</Notice>}
      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => go(index - 1)} disabled={pending}>
          <ArrowLeft className="size-4" /> Zurück
        </Button>
        <Button variant="secondary" onClick={() => go(index + 1)} disabled={pending}>
          {index === total - 1 ? "Fertig" : "Weiter"} <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
