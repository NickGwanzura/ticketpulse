import { Skeleton } from "@/components/dashboard/Skeleton"

export default function VendorsLoading() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-line tp-header-bg">
        <div className="max-w-7xl mx-auto px-5 md:px-8 pt-12 md:pt-20 pb-10 md:pb-14">
          <Skeleton className="h-7 w-32 mb-6" rounded="full" />
          <Skeleton className="h-12 md:h-16 w-3/4 max-w-2xl mb-4" rounded="lg" />
          <Skeleton className="h-5 w-2/3 max-w-md" />
          <div className="mt-8 grid grid-cols-3 max-w-md gap-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-10">
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <Skeleton className="h-12 flex-1 max-w-xl" rounded="xl" />
          <Skeleton className="h-12 w-40" rounded="xl" />
        </div>
        <div className="flex gap-2 mb-8 flex-wrap">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24" rounded="full" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72" rounded="2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
