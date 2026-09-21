"use client"

import { useSyncExternalStore } from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  THEME_CHANGE_EVENT,
  nextPreference,
  readStoredPreference,
  setThemePreference,
  type ThemePreference,
} from "@/lib/theme"

const NAME: Record<ThemePreference, string> = { light: "Light", dark: "Dark", system: "System" }

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}
const getServerSnapshot = (): ThemePreference => "system"

const VARIANT = {
  /** For paper/card surfaces (public navbar, dashboards, checkout). */
  default: "border border-line bg-paper text-ink-2 hover:border-line-2 hover:bg-paper-2 hover:text-ink",
  /** For the deep-navy admin sidebar chrome. */
  onDark: "text-white/70 hover:bg-white/10 hover:text-white",
} as const

/**
 * Cycles light → dark → system. The icon (and the optional label) are chosen in
 * CSS from `<html data-theme-pref>`, which the pre-paint script in <head> has
 * already set — so the control is correct on first paint, never flickers
 * between icons during hydration, and its box never changes size. Only the
 * accessible name reads React state.
 */
export default function ThemeToggle({
  variant = "default",
  showLabel = false,
  className,
}: {
  variant?: keyof typeof VARIANT
  /** Render a "Theme: …" text label next to the icon (for menus). */
  showLabel?: boolean
  className?: string
}) {
  const preference = useSyncExternalStore(subscribe, readStoredPreference, getServerSnapshot)
  const next = nextPreference(preference)

  return (
    <button
      type="button"
      onClick={() => setThemePreference(next)}
      aria-label={`Theme: ${NAME[preference]}. Switch to ${NAME[next]}.`}
      title={`Theme: ${NAME[preference]}`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-3 rounded-lg transition-colors",
        showLabel ? "h-11 w-full justify-start px-3 text-[14px] font-medium" : "h-10 w-10",
        VARIANT[variant],
        className,
      )}
    >
      <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
        <Sun size={16} className="tp-theme-icon" data-for="light" />
        <Moon size={16} className="tp-theme-icon" data-for="dark" />
        <Monitor size={16} className="tp-theme-icon" data-for="system" />
      </span>
      {showLabel && (
        <span aria-hidden>
          Theme:{" "}
          <span className="tp-theme-label" data-for="light">Light</span>
          <span className="tp-theme-label" data-for="dark">Dark</span>
          <span className="tp-theme-label" data-for="system">System</span>
        </span>
      )}
    </button>
  )
}
