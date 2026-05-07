import { HeaderSkeleton, Skeleton, StatRowSkeleton } from "@/components/dashboard/Skeleton"

export default function DashboardLoading() {
  return (
    <div>
      <HeaderSkeleton />
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 md:py-12 space-y-8">
        <StatRowSkeleton />
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          <Skeleton className="col-span-12 md:col-span-7 h-[340px]" rounded="2xl" />
          <Skeleton className="col-span-12 md:col-span-5 h-[340px]" rounded="2xl" />
        </div>
        <Skeleton className="h-[280px]" rounded="2xl" />
      </div>
    </div>
  )
}
