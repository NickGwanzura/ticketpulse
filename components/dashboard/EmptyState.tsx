import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface Props {
  icon?: LucideIcon
  title: string
  body?: string
  ctaLabel?: string
  ctaHref?: string
  variant?: "card" | "inline"
  className?: string
}

export default function EmptyState({
  icon: Icon,
  title,
  body,
  ctaLabel,
  ctaHref,
  variant = "card",
  className,
}: Props) {
  const wrapper =
    variant === "card"
      ? "rounded-2xl border border-dashed border-line bg-paper-2/40 px-6 py-12 md:py-14"
      : "px-6 py-10"

  return (
    <div className={cn(wrapper, "text-center", className)}>
      {Icon && (
        <span className="inline-flex w-11 h-11 items-center justify-center rounded-2xl bg-paper ring-1 ring-line mb-4 shadow-sm shadow-ink/[0.04]">
          <Icon size={18} className="text-ink-3" />
        </span>
      )}
      <p className="text-[15px] font-semibold tracking-tight text-ink">{title}</p>
      {body && (
        <p className="mt-1.5 text-[13px] text-ink-2 max-w-sm mx-auto leading-relaxed">{body}</p>
      )}
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 active:scale-[0.99] transition"
        >
          {ctaLabel} <ArrowRight size={13} />
        </Link>
      )}
    </div>
  )
}
