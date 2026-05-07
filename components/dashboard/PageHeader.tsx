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
