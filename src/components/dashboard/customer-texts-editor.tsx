"use client";

import { Check, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { fillText, varHelp } from "@/lib/config/customer-texts";
import { apiFetch } from "@/lib/use-api";

interface TextItem {
  key: string;
  group: string;
  label: string;
  when: string;
  default: string;
  vars: string[];
  value: string;
}
interface Group {
  id: string;
  title: string;
  hint: string;
}

/** Beispielwerte für die Vorschau unter jedem Text. */
const SAMPLE: Record<string, string> = {
  name: "Frau Lehmann",
  firma: "Ihr Betrieb",
  leistung: "Dachreparatur",
  liste: "Straße, PLZ, Fotos vom Schaden",
  dokument: "Auftragsformular",
  hinweis: "Die Unterschrift fehlt.",
  beispiel: "Montag bis Freitag",
  tage: "Montag, Dienstag, Mittwoch, Donnerstag, Freitag",
  datum: "15. November 2026",
  termin: "Di., 17.11.2026, 10:00 Uhr",
  frage: "Wie lautet die Adresse?",
  link: "https://fallflow.xyz/upload/…",
};

/** „KI-Assistent → Texte“: jeder automatische Kundentext mit Standard, eigener Fassung, Platzhaltern und Vorschau. */
export function CustomerTextsEditor({ canEdit }: { canEdit: boolean }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [items, setItems] = useState<TextItem[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ groups: Group[]; texts: TextItem[] }>("GET", "/api/customer-texts")
      .then((r) => {
        setGroups(r.groups);
        setItems(r.texts);
        setValues(Object.fromEntries(r.texts.map((t) => [t.key, t.value || t.default])));
      })
      .catch(() => setError("Die Texte konnten nicht geladen werden."));
  }, []);

  const changed = useMemo(() => (items ?? []).filter((t) => (values[t.key] ?? "").trim() !== t.default.trim()).length, [items, values]);

  const set = (key: string, v: string) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    setSaved(false);
  };

  const save = async () => {
    if (!items) return;
    setSaving(true);
    setError(null);
    try {
      // Nur Abweichungen speichern; leer = Standard.
      const texts = Object.fromEntries(items.filter((t) => (values[t.key] ?? "").trim() && values[t.key].trim() !== t.default.trim()).map((t) => [t.key, values[t.key]]));
      await apiFetch("PUT", "/api/customer-texts", { texts });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  if (error && !items) return <Notice tone="error">{error}</Notice>;
  if (!items) return <p className="text-sm text-muted-foreground">Wird geladen …</p>;

  return (
    <div className="space-y-4">
      <Notice tone="info">
        Hier stehen alle Texte, die FallFlow automatisch an Ihre Kunden schickt. Ändern Sie sie, wie Sie möchten – Wörter in geschweiften Klammern wie {"{name}"} werden beim
        Versand ersetzt. Ein einzelnes „-“ schaltet einen Text ganz ab (z. B. keine Grußformel). Ihre Texte je Leistung bearbeiten Sie unter „Vorlagen &amp; Nachrichten“.
      </Notice>
      {groups.map((g, gi) => {
        const list = items.filter((t) => t.group === g.id);
        if (!list.length) return null;
        return (
          <details key={g.id} open={gi === 0} className="group rounded-2xl border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="font-semibold">{g.title}</span>
                {g.hint && <span className="mt-0.5 block text-sm text-muted-foreground">{g.hint}</span>}
              </span>
              <span className="text-xl leading-none text-muted-foreground transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="space-y-6 border-t border-border px-5 py-5">
              {list.map((t) => {
                const value = values[t.key] ?? "";
                const isChanged = value.trim() !== t.default.trim();
                const preview = value.trim() === "-" ? "(abgeschaltet – wird nicht verschickt)" : fillText(value || t.default, SAMPLE);
                return (
                  <Card key={t.key} className="p-4 shadow-none">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {t.label} {isChanged && <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">geändert</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{t.when}</p>
                      </div>
                      {canEdit && isChanged && (
                        <button type="button" onClick={() => set(t.key, t.default)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                          <RotateCcw className="size-3.5" /> Standard
                        </button>
                      )}
                    </div>
                    <Textarea
                      value={value}
                      onChange={(e) => set(t.key, e.target.value)}
                      disabled={!canEdit}
                      maxLength={1500}
                      aria-label={t.label}
                      className="mt-3 min-h-20 text-sm"
                    />
                    {t.vars.length > 0 && (
                      <p className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                        {t.vars.map((v) => (
                          <span key={v} className="rounded-md bg-muted px-1.5 py-0.5" title={varHelp(v)}>
                            {`{${v}}`} = {varHelp(v)}
                          </span>
                        ))}
                      </p>
                    )}
                    <p className="mt-2 whitespace-pre-line rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Vorschau: </span>
                      {preview}
                    </p>
                  </Card>
                );
              })}
            </div>
          </details>
        );
      })}
      {canEdit && (
        // Klebt unten im Inhaltsbereich – am Handy oberhalb der Menüleiste.
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur lg:bottom-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{changed ? `${changed} ${changed === 1 ? "Text" : "Texte"} geändert` : "Alle Texte im Standard"}</p>
            <div className="flex items-center gap-3">
              {error && <span className="text-sm text-danger">{error}</span>}
              {saved && (
                <span className="inline-flex items-center gap-1 text-sm text-success">
                  <Check className="size-4" /> Gespeichert
                </span>
              )}
              <Button onClick={save} loading={saving}>
                Speichern
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
