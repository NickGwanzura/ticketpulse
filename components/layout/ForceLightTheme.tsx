"use client"

import { useLayoutEffect } from "react"
import { lockTheme } from "@/lib/theme"

/**
 * Pins the route to the light theme. For paper-like documents (the printable
 * ticket page) that must look the same — and print the same — whatever theme
 * the visitor chose. The inline script makes the very first paint light on a
 * hard load; the layout effect covers client-side navigation and restores the
 * visitor's real preference on the way out.
 */
export default function ForceLightTheme() {
  useLayoutEffect(() => lockTheme("light"), [])
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `document.documentElement.setAttribute("data-theme","light");document.documentElement.style.colorScheme="light"`,
      }}
    />
  )
}