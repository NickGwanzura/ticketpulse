import { cn } from "@/lib/utils"
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

interface Props {
  label: string
  value: ReactNode
  icon?: LucideIcon
  iconBg?: string
  iconColor?: string
  trendLabel?: string
  trendDir?: "up" | "down" | "flat"
  spark?: ReactNode
  className?: string
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  iconBg = "bg-paper-2",
  iconColor = "text-ink-3",
  trendLabel,
  trendDir = "up",
  spark,
  className,
}: Props) {
  const TrendIcon = trendDir === "down" ? ArrowDownRight : ArrowUpRight
  const trendColor =
    trendDir === "down" ? "text-rose-700" : trendDir === "flat" ? "text-ink-3" : "text-green-700"

  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-paper p-5 tp-lift flex flex-col justify-between min-h-[120px]",
        className,
      )}
    >
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          {Icon && (
            <span className={cn("inline-flex w-6 h-6 items-center justify-center rounded-md", iconBg)}>
              <Icon size={12} className={iconColor} />
            </span>
          )}
          <span className="text-[12px] text-ink-3">{label}</span>
        </div>
        <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
          {value}
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        {trendLabel && (
          <span className={cn("inline-flex items-center gap-1 text-[12px] font-medium", trendColor)}>
            <TrendIcon size={11} /> {trendLabel}
          </span>
        )}
        {spark && <div className="flex-1 max-w-[120px]">{spark}</div>}
      </div>
    </div>
  )
}
