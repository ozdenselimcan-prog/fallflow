"use client";

import { Microscope, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import type { CaseEvent } from "@/lib/data/types";
import { apiFetch, useMutation } from "@/lib/use-api";
import { formatDateTime } from "@/lib/utils";

interface Props {
  caseId: string;
  events: CaseEvent[];
  canWrite: boolean;
}

/** Unverbindliche KI-Voreinschätzung zur Gesprächsvorbereitung (Baualter-typische Schwachstellen, mögliche
 * Maßnahmen, Prüfpunkte) aus Gebäudedaten, Energieausweis, Grundriss und Fotos. Nie für den Kunden sichtbar –
 * ersetzt keine fachliche Prüfung, nur eine Vorbereitungshilfe für den Berater. */
export function PreliminaryAssessmentCard({ caseId, events, canWrite }: Props) {
  const { pending, error, run } = useMutation();
  const latest = [...events].reverse().find((e) => e.type === "assessment");

  return (
    <Card>
      <CardHeader
        title="KI-Voreinschätzung"
        description="Vorbereitungshilfe für den Berater – unverbindlich, ersetzt keine fachliche Prüfung"
        action={
          canWrite && (
            <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => apiFetch("POST", `/api/cases/${caseId}/preliminary-assessment`, {}))}>
              <Sparkles className="size-3.5" /> {latest ? "Neu erstellen" : "Erstellen"}
            </Button>
          )
        }
      />
      <div className="px-5 py-4">
        {error && (
          <div className="mb-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        {latest ? (
          <div>
            <p className="whitespace-pre-line text-sm leading-relaxed">{latest.text}</p>
            <p className="mt-3 text-xs text-muted-foreground">Erstellt am {formatDateTime(latest.createdAt)} · nur intern, nicht für den Kunden.</p>
          </div>
        ) : (
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Microscope className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>Noch keine Voreinschätzung erstellt. Nutzt Gebäudedaten und hochgeladene Dokumente, um typische Schwachstellen und Prüfpunkte für das Gespräch zusammenzufassen.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
