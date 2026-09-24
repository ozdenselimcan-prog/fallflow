"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard/settings/profile", label: "Profil" },
  { href: "/dashboard/settings/company", label: "Unternehmen" },
  { href: "/dashboard/settings/assistant", label: "Assistent" },
  { href: "/dashboard/settings/billing", label: "Abrechnung" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Einstellungen" className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={pathname === t.href ? "page" : undefined}
          className={cn("whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium", pathname === t.href ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground")}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
