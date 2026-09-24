"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { BUILDING_TYPES, FIELD_GROUPS, HEATING_TYPES, OWNER_STATUSES, PRIORITIES, SERVICES } from "@/lib/cases/fields";
import { SKIPPED } from "@/lib/cases/completeness";
import { apiFetch, useMutation } from "@/lib/use-api";

const OPTIONS: Record<string, readonly string[]> = { buildingType: BUILDING_TYPES, heating: HEATING_TYPES, service: SERVICES, ownerStatus: OWNER_STATUSES, priority: PRIORITIES };

/** Anzeige der Falldaten in Gruppen mit Bearbeitungsmodus. Speichern berechnet die Vollständigkeit serverseitig neu. */
export function CaseEditor({
  caseId,
  fields,
  canWrite,
  extra = [],
  requiredKeys = [],
}: {
  caseId: string;
  fields: Record<string, string>;
  canWrite: boolean;
  extra?: { key: string; label: string }[];
  /** Schlüssel der Pflichtangaben – nur diese werden als „Fehlt noch“ hervorgehoben */
  requiredKeys?: string[];
}) {
  const groups = extra.length ? [...FIELD_GROUPS, { title: "Weitere Angaben", fields: extra }] : FIELD_GROUPS;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fields);
  const { pending, error, run } = useMutation();

  const startEdit = () => {
    setDraft(fields);
    setEditing(true);
  };

  const save = async () => {
    const changes = Object.fromEntries(Object.entries(draft).filter(([k, v]) => (fields[k] ?? "") !== v.trim() && v.trim()));
    if (Object.keys(changes).length === 0) return setEditing(false);
    const ok = await run(() => apiFetch("PATCH", `/api/cases/${caseId}`, { fields: changes }));
    if (ok) setEditing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fallakte</h2>
        {canWrite &&
          (editing ? (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Abbrechen
              </Button>
              <Button size="sm" loading={pending} onClick={save}>
                Speichern
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={startEdit}>
              <Pencil className="size-3.5" /> Bearbeiten
            </Button>
          ))}
      </div>
      {error && <Notice tone="error">{error}</Notice>}

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <Card key={group.title} className={group.title === "Anliegen" || group.title === "Weitere Angaben" ? "md:col-span-2" : undefined}>
            <CardHeader title={group.title} />
            <dl className="divide-y divide-border px-5">
              {group.fields.map((f) => {
                const value = fields[f.key];
                const missing = !value || value === SKIPPED;
                return (
                  <div key={f.key} className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:items-center">
                    <dt className="text-sm text-muted-foreground">{f.label}</dt>
                    <dd className="text-sm font-medium">
                      {editing ? (
                        f.key === "description" ? (
                          <Textarea value={draft[f.key] ?? ""} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} maxLength={1000} />
                        ) : OPTIONS[f.key] ? (
                          <Select value={draft[f.key] ?? ""} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}>
                            <option value="">–</option>
                            {OPTIONS[f.key].map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </Select>
                        ) : (
                          <Input value={draft[f.key] === SKIPPED ? "" : (draft[f.key] ?? "")} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} maxLength={200} />
                        )
                      ) : missing ? (
                        requiredKeys.includes(f.key) ? <span className="font-normal text-danger">Fehlt noch</span> : <span className="font-normal text-muted-foreground">–</span>
                      ) : (
                        <span className="whitespace-pre-line">{value}</span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Card>
        ))}
      </div>
    </div>
  );
}
