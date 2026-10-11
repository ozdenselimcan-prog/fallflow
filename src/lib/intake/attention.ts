import type { Appointment, CaseDocument, CaseRecord } from "@/lib/data/types";

export interface AttentionItem {
  id: string;
  tone: "accent" | "warning" | "success";
  text: string;
  href: string;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** „Anfragen, die Ihre Aufmerksamkeit brauchen“ – jeder Eintrag entspricht einer konkreten Handlung. */
export function buildAttention(input: { cases: CaseRecord[]; documents: CaseDocument[]; appointments: Appointment[] }): AttentionItem[] {
  const { cases, documents, appointments } = input;
  const items: AttentionItem[] = [];
  const open = cases.filter((c) => c.status !== "CONVERTED");

  // Zuerst, was nur das Büro erledigen kann: Kunden, die auf eine persönliche Antwort warten.
  const needsReply = cases.filter((c) => c.status === "NEEDS_REPLY").length;
  if (needsReply) items.push({ id: "reply", tone: "warning", text: `${needsReply} ${plural(needsReply, "Kunde wartet", "Kunden warten")} auf Ihre Antwort`, href: "/dashboard/inbox" });

  const fresh = cases.filter((c) => c.status === "NEW").length;
  if (fresh) items.push({ id: "new", tone: "accent", text: `${fresh} ${plural(fresh, "neue Anfrage muss", "neue Anfragen müssen")} geprüft werden`, href: "/dashboard/intake?status=NEW" });

  const withOpenDocs = new Set(documents.filter((d) => d.status === "requested" && open.some((c) => c.id === d.caseId)).map((d) => d.caseId)).size;
  if (withOpenDocs) {
    items.push({
      id: "docs",
      tone: "warning",
      text: `Bei ${withOpenDocs} Kunden fehlen noch Unterlagen`,
      href: "/dashboard/intake?filter=documents",
    });
  }

  const ready = cases.filter((c) => c.status === "READY_FOR_REVIEW").length;
  if (ready) {
    items.push({
      id: "ready",
      tone: "success",
      text: `${ready} ${plural(ready, "Fall ist", "Fälle sind")} vollständig und bereit zur Bearbeitung`,
      href: "/dashboard/cases?status=READY_FOR_REVIEW",
    });
  }

  const now = new Date().toISOString();
  const proposed = appointments.filter((a) => a.status === "proposed" && a.startsAt >= now).length;
  if (proposed) items.push({ id: "appointments", tone: "accent", text: `${proposed} ${plural(proposed, "Kunde wartet", "Kunden warten")} auf Terminbestätigung`, href: "/dashboard/calendar" });

  return items;
}
