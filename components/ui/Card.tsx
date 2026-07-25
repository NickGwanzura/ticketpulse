import { cn } from "@/lib/utils"

/**
 * Bordered rounded container — the `rounded-2xl border border-line bg-paper`
 * shell was hand-repeated on nearly every admin/organiser panel instead of
 * living in one place.
 */
export default function Card({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div className={cn("rounded-2xl border border-line bg-paper", padded && "p-5", className)}>
      {children}
    </div>
  )
}
