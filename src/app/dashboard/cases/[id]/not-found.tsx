import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function CaseNotFound() {
  return (
    <EmptyState
      title="Fall nicht gefunden"
      description="Dieser Beratungsfall existiert nicht oder gehört nicht zu Ihrem Büro."
      action={
        <Link href="/dashboard/cases" className={buttonStyles({ variant: "secondary" })}>
          Zur Fallliste
        </Link>
      }
    />
  );
}
