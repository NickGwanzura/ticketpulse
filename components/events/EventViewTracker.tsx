"use client"

import { useEffect } from "react"

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
  useEffect(() => {
    const viewedKey = `tp_event_viewed:${eventId}`
    if (window.sessionStorage.getItem(viewedKey)) return

    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "EVENT_VIEWED",
        eventId,
        sessionId: getSessionId(),
        referrer: document.referrer || null,
      }),
      keepalive: true,
    }).then((response) => {
      if (response.ok) window.sessionStorage.setItem(viewedKey, "1")
    }).catch(() => {
      // Analytics must never block or degrade event browsing; a later render
      // can retry if this request failed.
    })
  }, [eventId])

  return null
}
