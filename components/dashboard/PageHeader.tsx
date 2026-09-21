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
    <div className={cn("relative bg-chrome overflow-hidden", className)}>
      {/* Subtle radial glow in top-right */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)" }}
        aria-hidden
      />
      {/* Fine grid texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
        aria-hidden
      />
      <div
        className={cn(
          WIDTHS[width],
          width !== "full" && "mx-auto",
          "relative px-5 md:px-8 py-7 md:py-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4",
        )}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-white/65 uppercase mb-2">
            {eyebrow}
          </p>
          <h1 className="text-[24px] md:text-[32px] font-bold tracking-tight leading-[1.1] text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-[13px] text-white/75">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="shrink-0 flex items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  )
}
