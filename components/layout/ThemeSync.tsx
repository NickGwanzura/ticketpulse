"use client"

import { useEffect } from "react"
import { applyTheme, readStoredPreference, watchTheme } from "@/lib/theme"

/**
 * Mounted once (see Providers). The pre-paint script has already applied the
 * theme; this keeps it correct afterwards on every route — including pages
 * with no toggle, like checkout — when the OS scheme changes while on
 * "system", or the preference changes in another tab. It only mutates
 * <html> attributes, so no application state is touched.
 */
export default function ThemeSync() {
  useEffect(() => {
    applyTheme(readStoredPreference())
    return watchTheme()
  }, [])
  return null
}
