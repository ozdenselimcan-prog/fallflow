import { redirect } from "next/navigation";

/** Der frühere „Anfragen“-Posteingang ist in „Anfragen“ (/dashboard/intake) aufgegangen. */
export default function RequestsPage() {
  redirect("/dashboard/intake");
}
