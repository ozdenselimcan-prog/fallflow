import type { Metadata } from "next";
import { ChannelCards } from "@/components/dashboard/channel-cards";
import { PageHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { siteConfig } from "@/lib/config/site";
import { getStore } from "@/lib/data";

export const metadata: Metadata = { title: "Kanäle" };

export default async function ChannelsPage({ searchParams }: PageProps<"/dashboard/channels">) {
  const { integration } = await searchParams;
  const session = await requireSession();
  const store = await getStore(session);
  const [channels, company] = await Promise.all([store.listChannels(), store.getCompany()]);

  return (
    <>
      <PageHeader title="Kanäle" description="Über welche Wege Anfragen bei FallFlow ankommen." />
      {integration === "not-ready" && (
        <div className="mb-4">
          <Notice>Die OAuth-Anmeldung wurde empfangen, der Token-Austausch ist aber noch nicht implementiert. Der Kanal bleibt daher „nicht verbunden“.</Notice>
        </div>
      )}
      <ChannelCards channels={channels} appUrl={siteConfig.appUrl} companyId={company.id} canManage={can(session.role, "company:manage")} />
    </>
  );
}
