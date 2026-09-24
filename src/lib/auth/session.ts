import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createUserClient } from "@/lib/supabase/clients";
import { isSupabaseConfigured } from "@/lib/utils";
import { DEMO_COMPANY_ID, DEMO_USER_ID } from "@/lib/data/seed";
import type { Role } from "@/lib/data/types";

export interface Session {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  companyId: string;
  role: Role;
  /** true = kein Supabase konfiguriert, Demo-Daten im Arbeitsspeicher */
  demo: boolean;
}

export const getSession = cache(async (): Promise<Session | null> => {
  if (!isSupabaseConfigured()) {
    await connection(); // Demo-Daten ändern sich zur Laufzeit → nie statisch prerendern
    return {
      userId: DEMO_USER_ID,
      email: "max@example.com",
      firstName: "Max",
      lastName: "Mustermann",
      companyId: DEMO_COMPANY_ID,
      role: "OWNER",
      demo: true,
    };
  }
  const db = await createUserClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;

  const { data: member } = await db
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!member) return null;

  const { data: profile } = await db.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle();
  return {
    userId: user.id,
    email: user.email ?? "",
    firstName: profile?.first_name ?? "",
    lastName: profile?.last_name ?? "",
    companyId: member.company_id,
    role: member.role as Role,
    demo: false,
  };
});

/** Für Server Components: leitet ohne Session auf /login um. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
