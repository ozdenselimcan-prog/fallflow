import { redirect } from "next/navigation";

/** Der frühere „Anfragen“-Posteingang ist im AI Intake aufgegangen. */
export default function RequestsPage() {
  redirect("/dashboard/intake");
}
