import { redirect } from "next/navigation";

/** Alter Pfad – der KI-Assistent hat eine eigene, vollwertige Seite statt eines Einstellungs-Reiters. */
export default function AssistantSettingsRedirect() {
  redirect("/dashboard/assistant");
}
