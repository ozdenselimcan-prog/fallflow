import { apiError, json, withSession } from "@/lib/api";
import { isPlatformAdmin } from "@/lib/admin/overview";
import { deleteCompany } from "@/lib/billing/account-deletion";
import { createAdminClient } from "@/lib/supabase/clients";

/** Nur automatisch erzeugte Testkonten (claude-…@mailinator.com) – echte Kundenkonten fasst das nie an. */
const TEST_ACCOUNT = /^claude-[^@]+@mailinator\.com$/i;

/** Betreiber: alle Testkonten samt Daten löschen. */
export const POST = withSession(
  async (_req, { session }) => {
    if (!isPlatformAdmin(session.email)) return apiError("Nicht gefunden", 404);
    const admin = createAdminClient();
    if (!admin) return apiError("Service-Role-Key fehlt", 500);
    const { data, error } = await admin.from("company_members").select("company_id, email").eq("role", "OWNER");
    if (error) return apiError(error.message, 500);
    const ids = [...new Set((data ?? []).filter((m) => TEST_ACCOUNT.test(m.email)).map((m) => m.company_id as string))];
    let deleted = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await deleteCompany(id);
        deleted++;
      } catch (err) {
        failed++;
        console.error("[admin/cleanup]", id, err instanceof Error ? err.message : "Fehler");
      }
    }
    return json({ deleted, failed });
  },
  { limit: 5 },
);
