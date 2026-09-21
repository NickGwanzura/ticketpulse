import { cn } from "@/lib/utils"

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "violet"

const TONE_STYLE: Record<BadgeTone, string> = {
  neutral: "bg-paper-3 text-ink-2",
  info: "bg-sky-50 text-sky-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  violet: "bg-violet-50 text-violet-700",
}

/**
 * Status pill — before this, every table (payouts, events, orders...)
 * defined its own STATUS_STYLE color map and repeated the same
 * `text-[11px] font-semibold uppercase px-2 py-1 rounded-full` markup.
 */
export default function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[11px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full whitespace-nowrap",
        TONE_STYLE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
