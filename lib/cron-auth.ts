import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"

/**
 * Verify that the request has a valid CRON_SECRET header.
 * Call this at the top of any cron endpoint to prevent unauthorized invocation.
 *
 * Fails CLOSED: if CRON_SECRET is not configured the endpoint returns 503
 * rather than running unprotected. A missing env var silently disabling auth
 * on endpoints that send mail, expire orders, and move money was a deployment
 * footgun.
 */
export function verifyCronSecret(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[cron-auth] CRON_SECRET is not set — refusing to run cron endpoint")
    return NextResponse.json({ error: "cron_not_configured" }, { status: 503 })
  }

  const provided = request.headers.get("x-cron-secret")
  if (!provided || !constantTimeEqual(provided, cronSecret)) {
    console.warn("[cron-auth] invalid cron secret")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  return null
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}
