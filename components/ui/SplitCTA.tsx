import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

type Size = "sm" | "md" | "lg"

interface SplitCTAProps {
  href: string
  label: string
  size?: Size
  className?: string
  target?: "_blank" | "_self"
  rel?: string
}

/**
 * Two-tone pill CTA: dark left section with label + burnt-sienna right cap
 * with an arrow. Matches the brand's split-button style.
 *
 * Usage:
 *   <SplitCTA href="/organizer/events/new" label="Create Event" />
 *   <SplitCTA href="/events" label="Get tickets" size="lg" />
 */
export default function SplitCTA({ href, label, size = "md", className = "", target, rel }: SplitCTAProps) {
  const sizeClass = size === "lg" ? "tp-btn-split--lg" : size === "sm" ? "tp-btn-split--sm" : ""

  const iconSize = size === "lg" ? 15 : size === "sm" ? 12 : 13

  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      className={`tp-btn-split ${sizeClass} ${className}`.trim()}
    >
      <span className="tp-btn-split__label">{label}</span>
      <span className="tp-btn-split__cap">
        <ArrowUpRight size={iconSize} strokeWidth={2.2} />
      </span>
    </Link>
  )
}
