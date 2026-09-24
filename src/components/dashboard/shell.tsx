"use client";

import { Bell, CalendarDays, FolderOpen, Globe, Inbox, LayoutDashboard, LogOut, Menu, Settings, Sparkles, Users, Workflow, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOutAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Inbox;
  exact?: boolean;
  prefix?: string;
}

/** Kern: von der Anfrage zum fertigen Fall. Alles Weitere ist Konfiguration und bewusst zweitrangig. */
const core: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/intake", label: "AI Intake", icon: Workflow },
  { href: "/dashboard/inbox", label: "Posteingang", icon: Inbox },
  { href: "/dashboard/cases", label: "Beratungsfälle", icon: FolderOpen },
  { href: "/dashboard/calendar", label: "Termine", icon: CalendarDays },
];
const config: NavItem[] = [
  { href: "/dashboard/assistant", label: "KI-Assistent", icon: Sparkles },
  { href: "/dashboard/channels", label: "Kanäle", icon: Globe },
  { href: "/dashboard/team", label: "Team", icon: Users },
  { href: "/dashboard/settings/profile", label: "Einstellungen", icon: Settings, prefix: "/dashboard/settings" },
];

interface Props {
  companyName: string;
  userName: string;
  userEmail: string;
  openRequests: number;
  demo: boolean;
  children: ReactNode;
}

export function DashboardShell({ companyName, userName, userEmail, openRequests, demo, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);


  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname.startsWith(item.prefix ?? item.href));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo href="/dashboard" />
        <button type="button" className="rounded-lg p-2 hover:bg-muted lg:hidden" aria-label="Menü schließen" onClick={() => setOpen(false)}>
          <X className="size-5" />
        </button>
      </div>
      <nav aria-label="Dashboard" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {[core, config].map((group, i) => (
          <div key={i} className={cn("space-y-1", i === 1 && "mt-5 border-t border-border pt-4")}>
            {i === 1 && <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">Konfiguration</p>}
            {group.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-accent-soft text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                >
                  <item.icon className="size-4.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-4 text-xs text-muted-foreground">{demo ? "Demo-Modus · Daten nur im Arbeitsspeicher" : companyName}</div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-card lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Menü schließen" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72 max-w-[85vw] bg-card shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
          <button type="button" className="rounded-lg p-2 hover:bg-muted lg:hidden" aria-label="Menü öffnen" onClick={() => setOpen(true)}>
            <Menu className="size-5" />
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{companyName}</p>
          <Link href="/dashboard/intake?status=NEW" aria-label={`Benachrichtigungen: ${openRequests} neue Anfragen`} className="relative rounded-xl p-2 hover:bg-muted">
            <Bell className="size-5" />
            {openRequests > 0 && <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">{openRequests}</span>}
          </Link>
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          </div>
          <form action={signOutAction}>
            <button type="submit" aria-label="Abmelden" title="Abmelden" className="rounded-xl p-2 hover:bg-muted">
              <LogOut className="size-5" />
            </button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
