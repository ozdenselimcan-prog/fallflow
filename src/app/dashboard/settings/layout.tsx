import { PageHeader } from "@/components/ui/card";

export default function SettingsLayout({ children }: LayoutProps<"/dashboard/settings">) {
  return (
    <>
      <PageHeader title="Einstellungen" />
      {children}
    </>
  );
}
