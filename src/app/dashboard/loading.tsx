import { Skeleton } from "@/components/ui/states";

export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Wird geladen" className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}
