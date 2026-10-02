"use client"

import { useEffect } from "react"
import { hasAnalyticsConsent } from "@/lib/cookie-preferences"
import { useCookiePreferences } from "@/lib/use-cookie-preferences"

function getSessionId() {
  const key = "tp_analytics_session"
  const existing = window.sessionStorage.getItem(key)
  if (existing) return existing
  const created = crypto.randomUUID()
  window.sessionStorage.setItem(key, created)
  return created
}

/** Records one view per event and browser session for the organizer funnel. */
export default function EventViewTracker({ eventId }: { eventId: string }) {
  const analytics = useCookiePreferences()
  useEffect(() => {
    if (analytics !== true || !hasAnalyticsConsent()) return
    const viewedKey = `tp_event_viewed:${eventId}`
    try {
      if (window.sessionStorage.getItem(viewedKey)) return
    } catch { return }

    let sessionId: string
    try { sessionId = getSessionId() } catch { return }

    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "EVENT_VIEWED",
        eventId,
        sessionId,
        referrer: document.referrer || undefined,
      }),
      keepalive: true,
    }).then((response) => {
      if (response.ok && hasAnalyticsConsent()) {
        try { window.sessionStorage.setItem(viewedKey, "1") } catch { /* Storage may be unavailable. */ }
      }
    }).catch(() => {
      // Analytics must never block or degrade event browsing; a later render
      // can retry if this request failed.
    })
  }, [eventId, analytics])

  return null
}
