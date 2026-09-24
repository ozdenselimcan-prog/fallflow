import { CheckCircle2, Circle, CircleDashed, Sparkles, X } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { STATUS_HINTS } from "@/lib/cases/fields";
import type { CaseRecord } from "@/lib/data/types";
import { missingLabel, READINESS_LABELS, type Checklist, type Readiness } from "@/lib/intake/checklist";
import { cn } from "@/lib/utils";

/** Vollständigkeits-Checkliste: Score, bekannte und fehlende Angaben/Dokumente. */
export function CompletenessCard({ checklist, readiness }: { checklist: Checklist; readiness: Readiness }) {
  const { percent, missing, items } = checklist;
  const complete = percent >= 100;
  return (
    <Card>
      <CardHeader title="Case Completeness Score" description={missingLabel(missing.length)} action={<Badge tone={complete || readiness === "ready" ? "success" : readiness === "almost" ? "warning" : "neutral"}>{READINESS_LABELS[readiness]}</Badge>} />
      <div className="space-y-5 px-5 py-5">
        <div>
          <div className="flex items-end justify-between">
            <p className="text-4xl font-semibold tabular-nums tracking-tight">{percent} %</p>
            <p className="text-sm text-muted-foreground">
              {checklist.requiredDone} von {checklist.requiredTotal} Pflichtpunkten
            </p>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Vollständigkeit">
            <div className={cn("h-full rounded-full transition-all", complete ? "bg-success" : "bg-accent")} style={{ width: `${percent}%` }} />
          </div>
        </div>
        <ul className="grid gap-y-1.5">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="vorhanden" />
              ) : item.required ? (
                <X className="size-4 shrink-0 text-danger" aria-label="fehlt" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground/50" aria-label="optional, nicht vorhanden" />
              )}
              <span className={cn(!item.done && item.required && "font-medium")}>{item.label}</span>
              {item.kind === "document" && !item.done && item.requested && <Badge tone="warning">angefordert</Badge>}
              {!item.required && !item.done && <span className="text-xs text-muted-foreground">optional</span>}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

/** Zeigt live, was die KI schon weiß und was sie gerade noch erfragt. */
export function AiStatusCard({ checklist, status }: { checklist: Checklist; status: CaseRecord["status"] }) {
  const active = status === "NEW" || status === "QUALIFYING";
  const known = checklist.items.filter((i) => i.kind === "field" && i.done);
  const open = checklist.missingFields;
  if (!active && open.length === 0) return null;
  return (
    <Card className={cn(active && "border-accent/40")}>
      <div className="flex items-start gap-3 px-5 py-4">
        <span className="relative mt-1 flex size-2.5 shrink-0">
          {active && <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />}
          <span className={cn("relative inline-flex size-2.5 rounded-full", active ? "bg-accent" : "bg-warning")} />
        </span>
        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-sm font-semibold">{active ? "KI sammelt gerade die fehlenden Informationen" : "Es fehlen noch Angaben"}</p>
            <p className="text-sm text-muted-foreground">{STATUS_HINTS[status]}</p>
          </div>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Bereits bekannt: </span>
              {known.length ? known.map((k) => k.label).join(" · ") : "noch nichts"}
            </p>
            <p>
              <span className="text-muted-foreground">Noch offen: </span>
              {open.length ? open.map((k) => k.label).join(" · ") : "keine Angaben – nur Dokumente"}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** „Fall automatisch vorbereitet“: Prüfschritte der Fallerstellung. */
export function PreparedCard({ checklist, fields, summary }: { checklist: Checklist; fields: Record<string, string>; summary: string }) {
  const checks: { label: string; ok: boolean }[] = [
    { label: "Kundendaten erkannt", ok: Boolean(fields.name && (fields.email || fields.phone)) },
    { label: "Gebäude erkannt", ok: Boolean(fields.buildingType && fields.yearBuilt && fields.livingArea) },
    { label: "Anliegen erkannt", ok: Boolean(fields.service) },
    { label: "Fehlende Informationen geprüft", ok: checklist.dataComplete },
    { label: "Dokumente geprüft", ok: checklist.unrequestedDocuments.length === 0 && checklist.missing.filter((i) => i.kind === "document").length === 0 },
    { label: "Zusammenfassung erstellt", ok: Boolean(summary) },
  ];
  return (
    <Card>
      <CardHeader title="Fall automatisch vorbereitet" description="Prüfschritte der KI vor der Übergabe an den Berater" />
      <ul className="grid gap-1.5 px-5 py-4">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-sm">
            {c.ok ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="erledigt" /> : <CircleDashed className="size-4 shrink-0 text-muted-foreground" aria-label="offen" />}
            <span className={cn(!c.ok && "text-muted-foreground")}>{c.label}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function SummaryCard({ summary }: { summary: string }) {
  return (
    <Card className="border-accent/30 bg-accent-soft/50">
      <div className="flex gap-3 p-5">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold">KI-Zusammenfassung</h2>
          <p className="mt-1 text-sm leading-relaxed">{summary || "Noch keine Zusammenfassung – sie entsteht, sobald genug Angaben vorliegen."}</p>
          <p className="mt-2 text-xs text-muted-foreground">Automatisch aus den erfassten Angaben erstellt – bitte fachlich prüfen.</p>
        </div>
      </div>
    </Card>
  );
}
