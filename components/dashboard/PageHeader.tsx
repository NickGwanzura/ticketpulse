import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface Props {
  eyebrow: string
  title: string
  subtitle?: string
  actions?: ReactNode
  width?: "lg" | "xl" | "full"
  className?: string
}

const WIDTHS = {
  lg:   "max-w-5xl",
  xl:   "max-w-7xl",
  full: "",
} as const

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  width = "xl",
  className,
}: Props) {
  return (
    <div className={cn("relative overflow-hidden border-b border-line", className)}>
      <div className="absolute inset-0 -z-10 tp-header-bg" aria-hidden />
      {/* Subtle animated accent arc in the top-right */}
      <svg
        className="absolute -top-6 -right-6 -z-10 w-36 h-36 opacity-30 hidden md:block"
        viewBox="0 0 100 100"
        aria-hidden
      >
        <defs>
          <linearGradient id="headerArc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0570DE" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0570DE" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M10 80 Q 30 25, 80 10"
          fill="none"
          stroke="url(#headerArc)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="2 4"
        />
      </svg>
      <div
        className={cn(
          WIDTHS[width],
          width !== "full" && "mx-auto",
          "px-5 md:px-8 py-9 md:py-12 flex flex-col md:flex-row md:items-end md:justify-between gap-5",
        )}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">
            {eyebrow}
          </p>
          <h1 className="text-[28px] md:text-[36px] font-bold tracking-tight leading-[1.1] text-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-[14.5px] text-ink-2">{subtitle}</p>
          )}
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
