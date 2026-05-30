"use client"

import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface PaginationProps {
  currentPage: number
  totalPages: number
  baseUrl: string
  queryParams?: Record<string, string | undefined>
  className?: string
}

export default function Pagination({
  currentPage,
  totalPages,
  baseUrl,
  queryParams = {},
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const buildUrl = (page: number) => {
    const params = new URLSearchParams()
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value && value !== "all") params.set(key, value)
    })
    params.set("page", String(page))
    return `${baseUrl}?${params.toString()}`
  }

  // Build page numbers to show
  const pages: (number | "ellipsis")[] = []
  const showEllipsis = totalPages > 7

  if (!showEllipsis) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, "ellipsis", totalPages)
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
    } else {
      pages.push(1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages)
    }
  }

  return (
    <div className={cn("flex items-center justify-between gap-3 px-5 py-4 border-t border-line", className)}>
      <p className="text-[12.5px] text-ink-3">
        Page <span className="font-semibold text-ink">{currentPage}</span> of{" "}
        <span className="font-semibold text-ink">{totalPages}</span>
      </p>

      <div className="flex items-center gap-1">
        {currentPage > 1 && (
          <Link
            href={buildUrl(currentPage - 1)}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[12.5px] font-medium text-ink-2 hover:text-ink hover:bg-paper-2 transition-colors"
          >
            <ChevronLeft size={14} /> Previous
          </Link>
        )}

        <div className="hidden sm:flex items-center gap-0.5">
          {pages.map((p, i) =>
            p === "ellipsis" ? (
              <span key={`ellipsis-${i}`} className="px-2 py-1 text-[12.5px] text-ink-3">
                …
              </span>
            ) : (
              <Link
                key={p}
                href={buildUrl(p)}
                className={cn(
                  "inline-flex items-center justify-center min-w-[32px] h-8 rounded-lg text-[12.5px] font-medium transition-colors",
                  p === currentPage
                    ? "bg-navy text-white"
                    : "text-ink-2 hover:text-ink hover:bg-paper-2"
                )}
              >
                {p}
              </Link>
            )
          )}
        </div>

        {currentPage < totalPages && (
          <Link
            href={buildUrl(currentPage + 1)}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[12.5px] font-medium text-ink-2 hover:text-ink hover:bg-paper-2 transition-colors"
          >
            Next <ChevronRight size={14} />
          </Link>
        )}
      </div>
    </div>
  )
}
