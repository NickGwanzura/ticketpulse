"use client"

import { COOKIE_SETTINGS_EVENT } from "@/lib/cookie-preferences"

export default function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))}>
      Cookie settings
    </button>
  )
}
