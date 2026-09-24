"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/ui/logo";
import { buttonStyles } from "@/components/ui/button";
import { navLinks } from "@/lib/config/site";

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav aria-label="Hauptnavigation" className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className={buttonStyles({ variant: "ghost" })}>
            Login
          </Link>
          <Link href="/signup" className={buttonStyles()}>
            Kostenlos testen
          </Link>
        </div>
        <button type="button" className="rounded-lg p-2 hover:bg-muted lg:hidden" aria-label={open ? "Menü schließen" : "Menü öffnen"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-border bg-background px-4 pb-4 lg:hidden">
          <nav className="flex flex-col py-2" aria-label="Mobile Navigation">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-3 text-sm hover:bg-muted">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link href="/login" className={buttonStyles({ variant: "secondary" })}>
              Login
            </Link>
            <Link href="/signup" className={buttonStyles()}>
              Kostenlos testen
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
