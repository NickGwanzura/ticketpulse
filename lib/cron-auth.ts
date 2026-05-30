import { NextResponse } from "next/server"

/**
 * Verify that the request has a valid CRON_SECRET header.
 * Call this at the top of any cron endpoint to prevent unauthorized invocation.
 */
export function verifyCronSecret(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.warn("[cron-auth] CRON_SECRET not set — skipping auth check")
    return null
  }

  const provided = request.headers.get("x-cron-secret")
  if (provided !== cronSecret) {
    console.warn("[cron-auth] invalid cron secret")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  return null
}
