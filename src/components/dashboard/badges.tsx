import { Globe, Mail, MessageCircle, Phone } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { STATUS_LABELS } from "@/lib/cases/fields";
import type { CaseStatus, MessageChannel } from "@/lib/data/types";
import { READINESS_LABELS, type Readiness } from "@/lib/intake/checklist";
import { cn } from "@/lib/utils";

const statusTone: Record<CaseStatus, "accent" | "warning" | "success" | "neutral"> = {
  NEW: "accent",
  QUALIFYING: "accent",
  WAITING_FOR_CUSTOMER: "warning",
  COMPLETE: "success",
  READY_FOR_REVIEW: "success",
  CONVERTED: "neutral",
};

export const StatusBadge = ({ status }: { status: CaseStatus }) => <Badge tone={statusTone[status]}>{STATUS_LABELS[status]}</Badge>;

const readinessTone: Record<Readiness, "neutral" | "warning" | "accent" | "success"> = {
  incomplete: "neutral",
  almost: "warning",
  complete: "accent",
  ready: "success",
};

export const ReadinessBadge = ({ readiness }: { readiness: Readiness }) => <Badge tone={readinessTone[readiness]}>{READINESS_LABELS[readiness]}</Badge>;

/** Fortschrittsbalken mit Prozentwert (Case Completeness Score). */
export function Completeness({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label="Vollständigkeit">
        <div className={cn("h-full rounded-full", value >= 100 ? "bg-success" : "bg-accent")} style={{ width: `${value}%` }} />
      </div>
      <span className="text-sm tabular-nums">{value} %</span>
    </div>
  );
}

const channelInfo = {
  website: { label: "Website", icon: Globe },
  email: { label: "E-Mail", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  phone: { label: "Telefon", icon: Phone },
} as const;

export const channelLabel = (c: MessageChannel) => channelInfo[c].label;

export function ChannelBadge({ channel, simulated }: { channel: MessageChannel; simulated?: boolean }) {
  const { label, icon: Icon } = channelInfo[channel];
  return (
    <Badge tone="neutral">
      <Icon className="size-3" aria-hidden /> {label}
      {simulated ? " · Simulation" : ""}
    </Badge>
  );
}
