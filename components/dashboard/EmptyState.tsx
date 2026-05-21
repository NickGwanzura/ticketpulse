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
      ? "rounded-2xl border border-dashed border-line bg-paper-2/40 px-6 py-12 md:py-14 relative overflow-hidden"
      : "px-6 py-10 relative"

  return (
    <div className={cn(wrapper, "text-center", className)}>
      {/* Decorative dot grid pattern in the background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.25]"
        style={{
          backgroundImage: "radial-gradient(circle, var(--color-ink) 0.5px, transparent 0.5px)",
          backgroundSize: "20px 20px",
          maskImage: variant === "card"
            ? "radial-gradient(70% 70% at 50% 50%, black 0%, transparent 90%)"
            : "linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)",
          WebkitMaskImage: variant === "card"
            ? "radial-gradient(70% 70% at 50% 50%, black 0%, transparent 90%)"
            : "linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)",
        }}
        aria-hidden
      />

      <div className="relative">
        {Icon && (
          <span className="inline-flex w-12 h-12 items-center justify-center rounded-2xl bg-paper ring-1 ring-line mb-4 shadow-sm shadow-ink/[0.04] ring-offset-2 ring-offset-transparent">
            <Icon size={19} className="text-ink-3" />
          </span>
        )}
        <p className="text-[15px] font-semibold tracking-tight text-ink">{title}</p>
        {body && (
          <p className="mt-1.5 text-[13px] text-ink-2 max-w-sm mx-auto leading-relaxed">{body}</p>
        )}
        {ctaLabel && ctaHref && (
          <Link
            href={ctaHref}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 active:scale-[0.97] transition-all"
          >
            {ctaLabel} <ArrowRight size={13} />
          </Link>
        )}
      </div>
    </div>
  )
}
