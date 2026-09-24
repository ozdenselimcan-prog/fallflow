import { SettingsTabs } from "@/components/dashboard/settings-tabs";
import { PageHeader } from "@/components/ui/card";

export default function SettingsLayout({ children }: LayoutProps<"/dashboard/settings">) {
  return (
    <>
      <PageHeader title="Einstellungen" />
      <SettingsTabs />
      <div className="mt-6 max-w-2xl">{children}</div>
    </>
  );
}
