import { redirect } from "next/navigation";

export default function BareSettingsConnectionsRedirect() {
  redirect("/dashboard/settings/connections");
}
