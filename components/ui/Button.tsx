import Link from "next/link"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react"

type Variant = "primary" | "secondary" | "ghost" | "subtle" | "destructive" | "white"
type Size = "sm" | "md" | "lg" | "xl"

const VARIANTS: Record<Variant, string> = {
  primary:     "bg-brand-600 text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.99] focus-visible:ring-brand-600/30",
  secondary:   "border border-line bg-paper text-ink hover:border-line-2 hover:bg-paper-2 focus-visible:ring-brand-500/20",
  ghost:       "text-ink-2 hover:text-ink hover:bg-paper-2 focus-visible:ring-brand-500/20",
  subtle:      "bg-paper-2 text-ink ring-1 ring-line hover:bg-paper-3 focus-visible:ring-brand-500/20",
  destructive: "bg-rose-600 text-white shadow-sm shadow-rose-600/20 hover:bg-rose-700 active:scale-[0.99] focus-visible:ring-rose-500/30",
  white:       "bg-white text-navy shadow-sm shadow-ink/10 hover:bg-paper-2 active:scale-[0.99] focus-visible:ring-navy/20",
}

const SIZES: Record<Size, string> = {
  sm: "h-9  px-3.5 text-[13px]   rounded-sm gap-1.5",
  md: "h-11 px-4   text-[14px]   rounded-sm gap-2",
  lg: "h-12 px-5   text-[15px] rounded-sm gap-2",
  xl: "h-14 px-6   text-[15px]   rounded-sm gap-2",
}

const BASE = "inline-flex items-center justify-center font-semibold uppercase tracking-[0.08em] transition select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-current/none focus-visible:outline-none focus-visible:ring-4"

interface CommonProps {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  loading?: boolean
  className?: string
  children?: ReactNode
}

type ButtonProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps | "href"> & { href?: never }
type LinkProps = CommonProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps | "href"> & { href: string }

function classes({ variant = "primary", size = "md", fullWidth, loading, className }: CommonProps & { loading?: boolean }) {
  return cn(
    BASE,
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
    loading && "cursor-wait",
    className,
  )
}

export default function Button(props: ButtonProps | LinkProps) {
  const { variant, size, fullWidth, loading, className, children } = props
  const cls = classes({ variant, size, fullWidth, loading, className })

  if ("href" in props && props.href !== undefined) {
    const { href, ...rest } = props as LinkProps
    return (
      <Link href={href} className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {loading && <Loader2 size={14} className="animate-spin shrink-0" />}
        {children}
      </Link>
    )
  }

  const { disabled, ...rest } = props as ButtonProps
  return (
    <button className={cls} disabled={disabled || loading} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {loading && <Loader2 size={14} className="animate-spin shrink-0" />}
      {children}
    </button>
  )
}
