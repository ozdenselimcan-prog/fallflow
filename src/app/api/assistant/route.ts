import { json, parseBody, withSession } from "@/lib/api";
import { assistantSchema } from "@/lib/validation";

export const GET = withSession(async (_req, { store }) => json({ assistant: await store.getAssistant() }));

export const PUT = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, assistantSchema);
    if (!body.ok) return body.res;
    return json({ assistant: await store.saveAssistant(body.data) });
  },
  { permission: "assistant:manage" },
);
