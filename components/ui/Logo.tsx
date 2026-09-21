import { cn } from "@/lib/utils"

/**
 * The TicketPulse mark. The default artwork is near-black (#131132), which all
 * but disappears on dark surfaces, so the white artwork is swapped in under the
 * dark theme. Both <img>s are always in the DOM and CSS picks one (`dark:` keys
 * off <html data-theme>), so the swap is instant, needs no JavaScript, and can't
 * cause a hydration mismatch. The hidden one is lazy, so it only downloads if
 * the theme is ever switched.
 */
export default function Logo({ className }: { className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ticketpulse-logo.svg" alt="TicketPulse" className={cn("dark:hidden", className)} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ticketpulse-logo-white.svg" alt="TicketPulse" loading="lazy" className={cn("hidden dark:block", className)} />
    </>
  )
}
