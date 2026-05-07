import { HeaderSkeleton, Skeleton, StatRowSkeleton } from "@/components/dashboard/Skeleton"

export default function AdminLoading() {
  return (
    <div>
      <HeaderSkeleton />
      <div className="px-5 md:px-8 py-8 md:py-10 space-y-8">
        <StatRowSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
          <Skeleton className="lg:col-span-3 h-[420px]" rounded="2xl" />
          <Skeleton className="lg:col-span-2 h-[420px]" rounded="2xl" />
        </div>
        <Skeleton className="h-[220px]" rounded="2xl" />
      </div>
    </div>
  )
}
