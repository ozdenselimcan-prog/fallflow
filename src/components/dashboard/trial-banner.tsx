"use client";

import { Clock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonStyles } from "@/components/ui/button";

/** Hinweis während der kostenlosen Testphase ohne Zahlungsmethode – auf jeder Dashboard-Seite. */
export function TrialBanner({ daysLeft, canManage }: { daysLeft: number; canManage: boolean }) {
  // Auf der Bezahlseite selbst ist der Hinweis doppelt.
  if (usePathname() === "/dashboard/payment") return null;
  const days = daysLeft === 1 ? "1 Tag" : `${daysLeft} Tage`;
  return (
    <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2 sm:px-4 sm:py-3">
      <p className="flex min-w-0 items-start gap-2 text-sm">
        <Clock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <span>
          <span className="font-semibold">
            <span className="sm:hidden">Testphase: noch {days}</span>
            <span className="hidden sm:inline">Kostenlose Testphase: noch {days}.</span>
          </span>
          <span className="hidden sm:inline"> Hinterlegen Sie eine Zahlungsmethode, um FallFlow danach weiter zu nutzen – abgebucht wird erst nach Ende der Testphase.</span>
        </span>
      </p>
      {canManage && (
        <Link href="/dashboard/payment" className={buttonStyles({ size: "sm", className: "shrink-0" })}>
          <span className="sm:hidden">Zahlung hinterlegen</span>
          <span className="hidden sm:inline">Zahlungsmethode hinterlegen</span>
        </Link>
      )}
    </div>
  );
}
