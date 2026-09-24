"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Switch } from "@/components/ui/form";
import { EmptyState, Notice } from "@/components/ui/states";
import { QUESTION_TYPES, type Question, type QuestionType } from "@/lib/data/types";
import { apiFetch, useMutation } from "@/lib/use-api";

const TYPE_LABELS: Record<QuestionType, string> = { choice: "Auswahl", number: "Zahl", text: "Text", email: "E-Mail", phone: "Telefon", postal: "PLZ" };

interface Draft {
  id?: string;
  key: string;
  label: string;
  prompt: string;
  type: QuestionType;
  options: string;
  required: boolean;
  active: boolean;
}

const emptyDraft: Draft = { key: "", label: "", prompt: "", type: "text", options: "", required: false, active: true };

const slug = (s: string) =>
  "custom_" +
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 30);

export function QuestionBuilder({ questions, canEdit }: { questions: Question[]; canEdit: boolean }) {
  const { pending, error, setError, run } = useMutation();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<Question | null>(null);

  const save = (q: Question, patch: Partial<Question>) =>
    run(() => apiFetch("POST", "/api/questions", { id: q.id, key: q.key, label: q.label, prompt: q.prompt, type: q.type, options: q.options, required: q.required, active: q.active, ...patch }));

  const move = (index: number, dir: -1 | 1) => {
    const ids = questions.map((q) => q.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(() => apiFetch("PUT", "/api/questions", { ids }));
  };

  const openEdit = (q: Question) => {
    setError(null);
    setDraft({ id: q.id, key: q.key, label: q.label, prompt: q.prompt, type: q.type, options: q.options.join(", "), required: q.required, active: q.active });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const body = {
      id: draft.id,
      key: draft.key || slug(draft.label),
      label: draft.label,
      prompt: draft.prompt,
      type: draft.type,
      options: draft.type === "choice" ? draft.options.split(",").map((o) => o.trim()).filter(Boolean) : [],
      required: draft.required,
      active: draft.active,
    };
    const ok = await run(() => apiFetch("POST", "/api/questions", body));
    if (ok) setDraft(null);
  };

  return (
    <div className="space-y-4">
      {error && !draft && <Notice tone="error">{error}</Notice>}
      {canEdit && (
        <Button
          onClick={() => {
            setError(null);
            setDraft(emptyDraft);
          }}
        >
          <Plus className="size-4" /> Frage hinzufügen
        </Button>
      )}

      {questions.length === 0 ? (
        <EmptyState title="Noch keine Fragen." description="Fügen Sie Fragen hinzu, die der Assistent stellen soll." />
      ) : (
        <ol className="space-y-2">
          {questions.map((q, i) => (
            <li key={q.id}>
              <Card className={`flex flex-wrap items-center gap-x-4 gap-y-3 p-4 ${q.active ? "" : "opacity-60"}`}>
                <div className="flex flex-col">
                  <button type="button" aria-label="Nach oben" disabled={!canEdit || pending || i === 0} onClick={() => move(i, -1)} className="rounded p-0.5 hover:bg-muted disabled:opacity-30">
                    <ArrowUp className="size-4" />
                  </button>
                  <button type="button" aria-label="Nach unten" disabled={!canEdit || pending || i === questions.length - 1} onClick={() => move(i, 1)} className="rounded p-0.5 hover:bg-muted disabled:opacity-30">
                    <ArrowDown className="size-4" />
                  </button>
                </div>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-medium">{q.label}</p>
                  <p className="truncate text-sm text-muted-foreground">{q.prompt}</p>
                  <div className="mt-1.5 flex gap-1.5">
                    <Badge>{TYPE_LABELS[q.type]}</Badge>
                    <Badge tone={q.required ? "accent" : "neutral"}>{q.required ? "Pflicht" : "Optional"}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Pflicht
                    <Switch checked={q.required} disabled={!canEdit || pending} onChange={(v) => save(q, { required: v })} label={`${q.label}: Pflichtfeld`} />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Aktiv
                    <Switch checked={q.active} disabled={!canEdit || pending} onChange={(v) => save(q, { active: v })} label={`${q.label}: aktiv`} />
                  </label>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" aria-label={`${q.label} bearbeiten`} onClick={() => openEdit(q)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={`${q.label} löschen`} onClick={() => setToDelete(q)}>
                        <Trash2 className="size-4 text-danger" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}

      <Dialog open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? "Frage bearbeiten" : "Frage hinzufügen"}>
        {draft && (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Bezeichnung">
              <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} required maxLength={80} />
            </Field>
            <Field label="Fragetext im Chat">
              <Input value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} required maxLength={300} />
            </Field>
            <Field label="Typ">
              <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as QuestionType })}>
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            {draft.type === "choice" && (
              <Field label="Optionen (Komma-getrennt)" hint="Mindestens zwei, z. B. Ja, Nein">
                <Input value={draft.options} onChange={(e) => setDraft({ ...draft, options: e.target.value })} />
              </Field>
            )}
            {!draft.id && (
              <Field label="Schlüssel (optional)" hint="Interner Name des Feldes. Wird sonst aus der Bezeichnung erzeugt.">
                <Input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} maxLength={40} placeholder="z. B. custom_dach" />
              </Field>
            )}
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={draft.required} onChange={(v) => setDraft({ ...draft, required: v })} label="Pflichtfrage" /> Pflicht
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} label="Aktiv" /> Aktiv
              </label>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Abbrechen
              </Button>
              <Button type="submit" loading={pending}>
                Speichern
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog open={toDelete !== null} onClose={() => setToDelete(null)} title="Frage löschen?">
        <p className="text-sm text-muted-foreground">
          „{toDelete?.label}“ wird aus dem Frage-Flow entfernt. Bereits erfasste Antworten in bestehenden Fällen bleiben erhalten.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setToDelete(null)}>
            Abbrechen
          </Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={async () => {
              if (!toDelete) return;
              const ok = await run(() => apiFetch("DELETE", `/api/questions?id=${encodeURIComponent(toDelete.id)}`));
              if (ok) setToDelete(null);
            }}
          >
            Löschen
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
