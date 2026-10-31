"use client";

import { Check } from "lucide-react";
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

const CHOICES: { id: Choice; label: string }[] = [
  { id: "yes", label: "Ja" },
  { id: "no", label: "Nein" },
  { id: "other", label: "Sonstiges" },
];

/**
 * Einrichtungs-Fragebogen: Ja / Nein / Sonstiges (eigene Antwort). Jede Antwort wird sofort gespeichert und stellt die
 * passenden Einstellungen ein (siehe config/setup-questions.ts) – in der Einrichtung und unter KI-Assistent → Fragebogen.
 */
export function SetupQuestionnaire({ canEdit = true }: { canEdit?: boolean }) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ questions: Question[] }>("GET", "/api/setup-questions")
      .then((r) => setQuestions(r.questions))
      .catch(() => setError("Fragen konnten nicht geladen werden."));
  }, []);

  const save = async (q: Question, answer: Answer) => {
    setQuestions((qs) => qs?.map((x) => (x.id === q.id ? { ...x, answer } : x)) ?? qs);
    // „Sonstiges“ ohne Text und „Ja“ mit Zusatzfeld werden erst gespeichert, wenn etwas eingetippt ist.
    if (answer.choice === "other" && !answer.text?.trim()) return;
    setBusy(q.id);
    setError(null);
    try {
      await apiFetch("POST", "/api/setup-questions", { id: q.id, ...answer });
      setSaved(q.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  };

  if (error && !questions) return <Notice tone="error">{error}</Notice>;
  if (!questions) return <p className="text-sm text-muted-foreground">Fragen werden geladen …</p>;

  const groups = [...new Set(questions.map((q) => q.group))];
  return (
    <div className="space-y-6">
      {error && <Notice tone="error">{error}</Notice>}
      {groups.map((g) => (
        <section key={g} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g}</h2>
          {questions
            .filter((q) => q.group === g)
            .map((q) => {
              const draft = drafts[q.id] ?? (q.answer.choice === "other" ? (q.answer.text ?? "") : (q.answer.extra ?? ""));
              return (
                <div key={q.id} className="rounded-xl border border-border bg-card p-4">
                  <p className="font-medium">{q.question}</p>
                  {q.hint && <p className="mt-0.5 text-xs text-muted-foreground">{q.hint}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={q.question}>
                    {CHOICES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        disabled={!canEdit}
                        aria-pressed={q.answer.choice === c.id}
                        onClick={() => {
                          setDrafts((d) => ({ ...d, [q.id]: "" }));
                          void save(q, { choice: c.id });
                        }}
                        className={cn(
                          "min-w-20 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
                          q.answer.choice === c.id ? "border-accent bg-accent text-white" : "border-border bg-background hover:border-accent/50",
                        )}
                      >
                        {c.label}
                      </button>
                    ))}
                    {busy === q.id && <span className="text-xs text-muted-foreground">wird übernommen …</span>}
                    {busy !== q.id && saved === q.id && (
                      <span className="flex items-center gap-1 text-xs text-success">
                        <Check className="size-3.5" /> übernommen
                      </span>
                    )}
                  </div>
                  {(q.answer.choice === "other" || (q.answer.choice === "yes" && q.extra)) && (
                    <form
                      className="mt-3 flex flex-col gap-2 sm:flex-row"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void save(q, q.answer.choice === "other" ? { choice: "other", text: draft } : { choice: "yes", extra: draft });
                      }}
                    >
                      <Input
                        value={draft}
                        disabled={!canEdit}
                        onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                        placeholder={q.answer.choice === "other" ? q.otherPlaceholder : q.extra?.placeholder}
                        aria-label={q.answer.choice === "other" ? "Ihre Antwort" : q.extra?.label}
                        className="flex-1"
                      />
                      <Button type="submit" size="sm" variant="secondary" disabled={!canEdit || !draft.trim()} loading={busy === q.id}>
                        Übernehmen
                      </Button>
                    </form>
                  )}
                </div>
              );
            })}
        </section>
      ))}
    </div>
  );
}
