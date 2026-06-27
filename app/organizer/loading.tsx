import { HeaderSkeleton, Skeleton, StatRowSkeleton } from "@/components/dashboard/Skeleton"

export default function OrganizerLoading() {
  return (
    <div>
      <HeaderSkeleton />
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 space-y-6">
        {/* Attention panel — 4 col grid */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-x-0 lg:divide-x divide-line">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="px-5 py-4 space-y-3">
                <Skeleton className="h-8 w-8" rounded="lg" />
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </div>

        {/* 4-cell KPI strip */}
        <StatRowSkeleton count={4} />

        {/* Events table + sidebar */}
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <Skeleton className="h-[420px]" rounded="2xl" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-[200px]" rounded="2xl" />
            <Skeleton className="h-[200px]" rounded="2xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
