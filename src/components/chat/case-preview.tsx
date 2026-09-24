import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { BUILDING_SHORT } from "@/lib/cases/fields";
import { cn } from "@/lib/utils";

interface Props {
  fields: Record<string, string>;
  completeness: number;
  className?: string;
}

/** Live-Vorschau eines Beratungsfalls (Landingpage-Hero und Demo). Leere Felder werden als Platzhalter gezeigt. */
export function CasePreview({ fields, completeness, className }: Props) {
  const rows: [string, string | undefined][] = [
    ["Interesse", fields.service],
    ["Gebäude", fields.buildingType ? (BUILDING_SHORT[fields.buildingType] ?? fields.buildingType) : undefined],
    ["Baujahr", fields.yearBuilt],
    ["Wohnfläche", fields.livingArea ? `${fields.livingArea} m²` : undefined],
    ["Heizung", fields.heating],
    ["PLZ", fields.postalCode],
    ["E-Mail", fields.email],
  ];
  const complete = completeness >= 100;

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground">BERATUNGSFALL</span>
        <Badge tone={complete ? "success" : "warning"}>{complete ? "Vollständig" : "In Bearbeitung"}</Badge>
      </div>
      <p className="mt-3 text-lg font-semibold">{fields.name || <span className="text-muted-foreground">Name folgt …</span>}</p>
      <dl className="mt-3 divide-y divide-border text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={cn("text-right font-medium transition-colors", !value && "text-muted-foreground/50")}>{value || "–"}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Vollständigkeit</span>
          <span className="flex items-center gap-1 font-semibold">
            {complete && <CheckCircle2 className="size-4 text-success" />}
            {completeness} %
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={completeness} aria-valuemin={0} aria-valuemax={100}>
          <div className={cn("h-full rounded-full transition-all duration-500", complete ? "bg-success" : "bg-accent")} style={{ width: `${completeness}%` }} />
        </div>
      </div>
    </div>
  );
}
