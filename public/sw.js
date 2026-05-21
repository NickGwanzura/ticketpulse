const CACHE = "ticketpulse-v1"

const PRECACHE_URLS = [
  "/",
  "/events",
  "/how-it-works",
  "/pricing",
  "/about",
  "/contact",
  "/help",
]

// ─── Install: precache key assets ───────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

// ─── Activate: clean old caches ─────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      ),
    ),
  )
  self.clients.claim()
})

// ─── Fetch: network-first with cache fallback ──────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return

  // Skip /api and static files that should always be fresh
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkOnly(request))
    return
  }

  event.respondWith(networkFirst(request))
})

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached

    // Offline fallback page
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline – TicketPulse</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100dvh;margin:0;background:#f4f7fa;color:#0a2540;text-align:center;padding:2rem}h1{font-size:1.75rem;margin-bottom:.5rem}p{color:#5a6d7e;max-width:360px}.dot{display:inline-block;width:12px;height:12px;border-radius:50%;background:#34d399;margin-top:1.5rem;box-shadow:0 0 0 5px rgba(52,211,153,.2)}</style></head>
<body><div><h1>You're offline</h1><p>TicketPulse needs a network connection to load. Check your connection and try again.</p><div class="dot"></div></div></body></html>`,
      {
        status: 503,
        headers: { "Content-Type": "text/html;charset=UTF-8" },
      },
    )
  }
}

async function networkOnly(request) {
  try {
    return await fetch(request)
  } catch {
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    })
  }
}
