import Link from "next/link"
import { ChevronRight } from "lucide-react"

export type Crumb = { label: string; href?: string }

/**
 * Nowhere in the app had a breadcrumb trail before this — on deeply nested
 * pages like /organizer/events/[id]/promos the only way back was the
 * sidebar itself. This is intentionally tiny: a label trail, not a full nav.
 */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 px-5 md:px-8 py-3 text-[12.5px] text-ink-3 border-b border-line bg-paper overflow-x-auto whitespace-nowrap">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={12} className="shrink-0 text-ink-4" aria-hidden />}
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-ink transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-semibold text-ink" : undefined} aria-current={isLast ? "page" : undefined}>
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
