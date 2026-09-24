import { json, parseBody, withSession } from "@/lib/api";
import { createUserClient } from "@/lib/supabase/clients";
import { profileSchema } from "@/lib/validation";

export const PUT = withSession(async (req, { session }) => {
  const body = await parseBody(req, profileSchema);
  if (!body.ok) return body.res;
  if (!session.demo) {
    const db = await createUserClient();
    const { error } = await db.from("profiles").update({ first_name: body.data.firstName, last_name: body.data.lastName }).eq("id", session.userId);
    if (error) throw new Error(error.message);
  }
  return json({ ok: true });
});
