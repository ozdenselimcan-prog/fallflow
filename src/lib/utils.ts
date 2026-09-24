import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateFmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const daysAgoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const berlinDayKey = (d: Date | string) => new Date(d).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

/** „heute“, „morgen“, „in 3 Tagen“, „gestern“ – relativ zum aktuellen Kalendertag (Europe/Berlin). */
export function relativeDay(iso: string, now = new Date()) {
  const diff = Math.round((Date.parse(berlinDayKey(iso)) - Date.parse(berlinDayKey(now))) / 86_400_000);
  if (diff === 0) return "heute";
  if (diff === 1) return "morgen";
  if (diff === -1) return "gestern";
  return diff > 1 ? `in ${diff} Tagen` : `vor ${-diff} Tagen`;
}

const timeFmt = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));

/** „vor 5 Min.“, „vor 3 Std.“, sonst Datum. */
export function timeAgo(iso: string, now = Date.now()) {
  const min = Math.round((now - Date.parse(iso)) / 60_000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  return formatDate(iso);
}
