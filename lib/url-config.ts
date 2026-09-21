import "server-only"
import { log } from "@/lib/logger"
import { generateOrderAccessUrl } from "@/lib/tickets"

const PRODUCTION_BASE_URL = "https://ticketpulse.tech"
const DEV_BASE_URL = "http://localhost:8080"

/**
 * Resolve the canonical base URL for the application.
 *
 * Priority:
 *   1. NEXT_PUBLIC_APP_URL env var (set on Railway/Vercel)
 *   2. APP_URL env var (server-side fallback)
 *   3. Railway-provided RAILWAY_PUBLIC_DOMAIN (auto-set by Railway)
 *   4. Hardcoded production domain (ticketpulse.tech)
 */
export function getBaseUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL

  if (envUrl) {
    const clean = envUrl.replace(/\/+$/, "")
    if (process.env.NODE_ENV === "production") {
      assertNotLocalhost(clean, "getBaseUrl")
    }
    return clean
  }

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  }

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_BASE_URL
  }

  return DEV_BASE_URL
}

// ── Payment URLs ────────────────────────────────────────────────────────────

export function getPaymentSuccessUrl(orderId: string): string {
  return `${getBaseUrl()}/orders/${orderId}?awaiting=1`
}

export function getPaymentCancelUrl(orderId: string): string {
  return `${getBaseUrl()}/orders/${orderId}?error=cancelled`
}

export function getVelocityReturnUrl(orderId: string): string {
  return `${getBaseUrl()}/api/checkout/velocity/return/${orderId}`
}

// ── Order / Ticket URLs ─────────────────────────────────────────────────────

export function getMyTicketsUrl(): string {
  return `${getBaseUrl()}/orders`
}

export function getOrderUrl(orderId: string): string {
  return generateOrderAccessUrl(orderId, getBaseUrl())
}

export function getTicketUrl(ticketId: string): string {
  return `${getBaseUrl()}/orders?ticket=${ticketId}`
}

export function getEventUrl(eventSlug: string): string {
  return `${getBaseUrl()}/events/${eventSlug}`
}

export function getAdminUrl(path: string): string {
  return `${getBaseUrl()}/admin/${path.replace(/^\//, "")}`
}

// ── Production Guard ────────────────────────────────────────────────────────

function assertNotLocalhost(url: string, source: string): void {
  if (
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("0.0.0.0") ||
    url.includes(":8080") ||
    url.includes(":3000")
  ) {
    log.error("url-config - production guard triggered", {
      generatedUrl: url,
      source,
      environment: process.env.NODE_ENV,
    })
    throw new Error(
      `[PRODUCTION GUARD] Refusing to use localhost URL "${url}" in production (source: ${source}). ` +
      `Set NEXT_PUBLIC_APP_URL to "${PRODUCTION_BASE_URL}" on the hosting platform.`,
    )
  }
}

// ── Logging helper ──────────────────────────────────────────────────────────

export function logUrlResolution(route: string, url: string): void {
  log.info("url-config resolved", {
    route,
    generatedUrl: url,
    environment: process.env.NODE_ENV,
    baseUrlSource: process.env.NEXT_PUBLIC_APP_URL
      ? "NEXT_PUBLIC_APP_URL"
      : process.env.APP_URL
        ? "APP_URL"
        : process.env.RAILWAY_PUBLIC_DOMAIN
          ? "RAILWAY_PUBLIC_DOMAIN"
          : "hardcoded_fallback",
    nextPublicAppUrlSet: !!process.env.NEXT_PUBLIC_APP_URL,
  })
}
