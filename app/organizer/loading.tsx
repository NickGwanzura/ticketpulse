import { HeaderSkeleton, Skeleton, StatRowSkeleton } from "@/components/dashboard/Skeleton"

export default function OrganizerLoading() {
  return (
    <div>
      <HeaderSkeleton />
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 space-y-8">
        <StatRowSkeleton />
        <Skeleton className="h-[260px]" rounded="2xl" />
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          <Skeleton className="col-span-12 lg:col-span-8 h-[380px]" rounded="2xl" />
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
            <Skeleton className="h-[180px]" rounded="2xl" />
            <Skeleton className="flex-1 h-[180px]" rounded="2xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
