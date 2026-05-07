import { cn } from "@/lib/utils"

interface SkeletonProps {
  className?: string
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "full"
}

const RADIUS = {
  sm:   "rounded",
  md:   "rounded-md",
  lg:   "rounded-lg",
  xl:   "rounded-xl",
  "2xl":"rounded-2xl",
  full: "rounded-full",
} as const

export function Skeleton({ className, rounded = "md" }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn("bg-paper-2 tp-skeleton", RADIUS[rounded], className)}
    />
  )
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-paper p-5">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-7 w-20 mb-3" rounded="sm" />
      <Skeleton className="h-3 w-28" />
    </div>
  )
}

export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {Array.from({ length: count }).map((_, i) => <StatCardSkeleton key={i} />)}
    </div>
  )
}

export function HeaderSkeleton() {
  return (
    <div className="border-b border-line bg-paper-2">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-9 md:py-12">
        <Skeleton className="h-3 w-20 mb-3" />
        <Skeleton className="h-9 md:h-11 w-72 max-w-full mb-3" rounded="lg" />
        <Skeleton className="h-3.5 w-56 max-w-full" />
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-line bg-paper overflow-hidden">
      <div className="px-5 md:px-6 py-4 border-b border-line">
        <Skeleton className="h-4 w-32" />
      </div>
      <ul className="divide-y divide-line">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="px-5 md:px-6 py-4 flex items-center gap-3">
            <Skeleton className="w-9 h-9" rounded="full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-3.5 w-16" />
          </li>
        ))}
      </ul>
    </div>
  )
}
