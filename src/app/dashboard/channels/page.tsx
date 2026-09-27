import { redirect } from "next/navigation";

/** Kanäle sind in die Verbindungen umgezogen (eigene Zugangsdaten pro Büro statt reiner Statusanzeige). */
export default function ChannelsPage() {
  redirect("/dashboard/settings/connections");
}
