import { Logo } from "@/components/ui/logo";
import { Notice } from "@/components/ui/states";
import { isSupabaseConfigured } from "@/lib/utils";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <Logo className="mb-8" />
      <div className="w-full max-w-md space-y-4">
        {!isSupabaseConfigured() && (
          <Notice>
            Demo-Modus: Supabase ist nicht konfiguriert. Anmeldung und Registrierung führen direkt in die Demo-Umgebung, die Daten liegen nur im Arbeitsspeicher.
          </Notice>
        )}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">{children}</div>
      </div>
    </main>
  );
}
