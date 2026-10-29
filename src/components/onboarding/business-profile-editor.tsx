"use client";

import { Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { INDUSTRY_PRESETS } from "@/lib/config/industry-presets";
import { apiFetch } from "@/lib/use-api";
import { cn } from "@/lib/utils";

export interface ProfileDraft {
  industry: string;
  description: string;
  services: string[];
  fields: { key: string; label: string; prompt: string; required: boolean; services?: string[] }[];
  documents: string[];
  humanTopics: string[];
  /** Unterlagen je Leistung (Vorschlag der KI, später unter "Vorlagen & Nachrichten" änderbar). */
  documentsByService?: Record<string, string[]>;
  /** Adresse des Kunden ist Pflicht (Arbeit vor Ort). Fehlt = ja. */
  needsAddress?: boolean;
}

export const EMPTY_DRAFT: ProfileDraft = { industry: "", description: "", services: [], fields: [], documents: [], humanTopics: [] };

/** Liste kurzer Einträge (Leistungen, Unterlagen, Themen) zum Hinzufügen und Entfernen. */
function ChipList({ label, hint, items, onChange, placeholder }: { label: string; hint?: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !items.some((i) => i.toLowerCase() === v.toLowerCase())) onChange([...items, v]);
    setDraft("");
  };
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((i) => (
          <li key={i} className="flex items-center gap-1 rounded-full border border-border bg-card py-1 pl-3 pr-1 text-sm">
            {i}
            <button type="button" onClick={() => onChange(items.filter((x) => x !== i))} aria-label={`${i} entfernen`} className="rounded-full p-1 text-muted-foreground hover:bg-muted">
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} placeholder={placeholder} />
        <Button type="button" variant="secondary" onClick={add} disabled={!draft.trim()} aria-label="Hinzufügen">
          <Plus className="size-4" /> <span className="hidden sm:inline">Hinzufügen</span>
        </Button>
      </div>
    </div>
  );
}

/**
 * Einrichtung "Ihr Betrieb": Der Betrieb beschreibt sich (oder nennt seine Website), die KI schlägt Branche, Leistungen,
 * Angaben, Unterlagen und Themen für den Menschen vor – alles bleibt frei änderbar.
 */
export function BusinessProfileEditor({ value, onChange, website }: { value: ProfileDraft; onChange: (v: ProfileDraft) => void; website: string }) {
  const [description, setDescription] = useState(value.description);
  const [useWebsite, setUseWebsite] = useState(Boolean(website));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newField, setNewField] = useState("");
  const set = (patch: Partial<ProfileDraft>) => onChange({ ...value, ...patch });
  const hasSuggestion = value.services.length > 0 || value.industry;

  async function suggest() {
    setPending(true);
    setError(null);
    try {
      const { suggestion } = await apiFetch<{ suggestion: ProfileDraft }>("POST", "/api/business-profile/suggest", { description, website: useWebsite ? website : "" });
      onChange({ ...suggestion, description: description || suggestion.description });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Der Vorschlag konnte nicht erstellt werden.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium">Schnellstart: Ihre Branche wählen</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Fertige Vorlage mit typischen Leistungen, Angaben und Unterlagen – danach können Sie alles anpassen.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {INDUSTRY_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setDescription(p.description);
                setError(null);
                onChange({
                  industry: p.industry,
                  description: p.description,
                  services: [...p.services],
                  fields: p.fields.map((x) => ({ ...x, services: [...x.services] })),
                  documents: [...p.documents],
                  documentsByService: { ...p.documentsByService },
                  humanTopics: [...p.humanTopics],
                  needsAddress: p.needsAddress,
                });
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                value.industry === p.industry ? "border-accent bg-accent-soft text-accent" : "border-border bg-card hover:bg-muted",
              )}
            >
              {p.title}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Andere Branche oder lieber individuell? Beschreiben Sie Ihren Betrieb – die KI macht einen passenden Vorschlag.</p>
        <Field label="Beschreiben Sie Ihren Betrieb in 2–3 Sätzen" hint="Was bieten Sie an, für wen, und welche Anfragen bekommen Sie typischerweise?">
          <Textarea
            rows={4}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              set({ description: e.target.value });
            }}
            placeholder="z. B. Wir sind eine Dachdeckerei aus München. Wir machen Reparaturen nach Sturmschäden, Neueindeckungen, Dachfenster und Dachrinnen für Privatkunden und Hausverwaltungen."
          />
        </Field>
        {website && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useWebsite} onChange={(e) => setUseWebsite(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            Auch meine Website lesen ({website.replace(/^https?:\/\//, "")})
          </label>
        )}
        <Button type="button" onClick={suggest} loading={pending} disabled={!description.trim() && !(useWebsite && website)}>
          <Sparkles className="size-4" /> {hasSuggestion ? "Neu vorschlagen lassen" : "Vorschlag mit KI erstellen"}
        </Button>
        {error && <Notice tone="error">{error}</Notice>}
      </div>

      {hasSuggestion && (
        <div className="space-y-6 rounded-2xl border border-border bg-muted/30 p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Prüfen und ändern Sie den Vorschlag – genau so arbeitet der Assistent danach für Sie.</p>
          <Field label="Branche">
            <Input value={value.industry} onChange={(e) => set({ industry: e.target.value })} placeholder="z. B. Dachdeckerei" />
          </Field>
          <ChipList label="Ihre Leistungen" hint="So erkennt der Assistent, was der Kunde möchte." items={value.services} onChange={(services) => set({ services })} placeholder="Leistung hinzufügen" />

          <div>
            <p className="text-sm font-medium">Angaben, die der Assistent erfragt</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Name, E-Mail, Telefon und Leistung fragt er immer ab. „Pflicht“ = ohne diese Angabe gilt der Fall nicht als vollständig.</p>
            <label className="mt-2 flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-sm">
              <input
                type="checkbox"
                checked={value.needsAddress ?? true}
                onChange={(e) => set({ needsAddress: e.target.checked })}
                className="mt-0.5 size-4 accent-[var(--accent)]"
              />
              <span>
                Adresse des Kunden ist Pflicht
                <span className="block text-xs text-muted-foreground">Für Arbeiten beim Kunden vor Ort. Kommt der Kunde zu Ihnen (z. B. Salon, Werkstatt), lassen Sie es aus.</span>
              </span>
            </label>
            <ul className="mt-2 space-y-2">
              {value.fields.map((f, i) => (
                <li key={f.key || i} className="rounded-xl border border-border bg-card p-2 pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={f.label}
                    onChange={(e) => set({ fields: value.fields.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })}
                    className="h-9 min-w-0 flex-1 basis-48"
                    aria-label="Bezeichnung der Angabe"
                  />
                  <button
                    type="button"
                    onClick={() => set({ fields: value.fields.map((x, k) => (k === i ? { ...x, required: !x.required } : x)) })}
                    className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-medium", f.required ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}
                    aria-pressed={f.required}
                  >
                    {f.required ? "Pflicht" : "Optional"}
                  </button>
                  <button type="button" onClick={() => set({ fields: value.fields.filter((_, k) => k !== i) })} aria-label={`${f.label} entfernen`} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
                    <X className="size-4" />
                  </button>
                  </div>
                  {value.services.length > 1 && (
                    <details className="group mt-1.5">
                      <summary className="cursor-pointer list-none text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                        Gilt für: {f.services?.length ? f.services.join(", ") : "alle Leistungen"} <span className="underline">ändern</span>
                      </summary>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {value.services.map((s) => {
                          const on = !f.services?.length || f.services.includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              aria-pressed={on}
                              onClick={() => {
                                const current = f.services?.length ? f.services : value.services;
                                const next = on ? current.filter((x) => x !== s) : [...current, s];
                                // Alle ausgewählt = keine Einschränkung; keine ausgewählt ist nicht sinnvoll.
                                if (next.length === 0) return;
                                const scope = next.length === value.services.length ? [] : next;
                                set({ fields: value.fields.map((x, k) => (k === i ? { ...x, services: scope } : x)) });
                              }}
                              className={cn("rounded-full px-2.5 py-1 text-xs font-medium", on ? "bg-accent-soft text-accent" : "bg-muted text-muted-foreground line-through")}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <Input value={newField} onChange={(e) => setNewField(e.target.value)} placeholder="Angabe hinzufügen, z. B. Dachfläche (m²)" />
              <Button
                type="button"
                variant="secondary"
                disabled={!newField.trim()}
                aria-label="Angabe hinzufügen"
                onClick={() => {
                  set({ fields: [...value.fields, { key: "", label: newField.trim(), prompt: `${newField.trim()}?`, required: false }] });
                  setNewField("");
                }}
              >
                <Plus className="size-4" /> <span className="hidden sm:inline">Hinzufügen</span>
              </Button>
            </div>
          </div>

          <ChipList label="Unterlagen, die Kunden schicken sollen" items={value.documents} onChange={(documents) => set({ documents })} placeholder="z. B. Fotos vom Schaden" />
          <ChipList
            label="Hier antworten Sie selbst – nicht die KI"
            hint="Fragt ein Kunde dazu, bekommen Sie Bescheid und antworten persönlich."
            items={value.humanTopics}
            onChange={(humanTopics) => set({ humanTopics })}
            placeholder="z. B. Preise, Notfälle"
          />
        </div>
      )}
    </div>
  );
}
