"use client"
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

type Theme = "light" | "dark"

const STORAGE_KEY = "ticketpulse-theme"

/**
 * Explicit override for the CSS-variable dark mode defined in globals.css.
 * Scoped to the admin area for now — the public/checkout pages weren't part
 * of this dashboard audit and haven't been visually verified in dark mode.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored) {
      setTheme(stored)
      document.documentElement.dataset.theme = stored
    } else {
      setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    }
  }, [])

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark"
    setTheme(next)
    document.documentElement.dataset.theme = next
    localStorage.setItem(STORAGE_KEY, next)
  }

  if (!theme) return <div className="w-8 h-8" aria-hidden />

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
    >
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  )
}
