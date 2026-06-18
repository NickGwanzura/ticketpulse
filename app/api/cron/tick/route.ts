/**
 * Combined cron entry point — call this every minute from Railway (or any
 * external scheduler) with the CRON_SECRET header.
 *
 * Runs all cron jobs in the correct dependency order:
 *   1. recheck-velocity  — confirms pending payments before anything expires
 *   2. expire-orders     — expires stale orders (safe now that paid ones are caught above)
 *
 * Railway cron setup:
 *   Create a cron job in the Railway dashboard:
 *     Schedule:  * * * * *   (every minute)
 *     Command:   curl -X POST https://ticketpulse.tech/api/cron/tick \
 *                     -H "x-cron-secret: $CRON_SECRET"
 */
import { NextResponse } from "next/server"
import { verifyCronSecret } from "@/lib/cron-auth"
import { log } from "@/lib/logger"

export async function POST(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
  const secret = process.env.CRON_SECRET ?? ""
  const headers = { "Content-Type": "application/json", "x-cron-secret": secret }

  const results: Record<string, unknown> = {}

  // 1. recheck-velocity first — marks paid orders before expire-orders can delete them
  try {
    const r = await fetch(`${base}/api/cron/recheck-velocity`, { method: "POST", headers })
    results.recheckVelocity = await r.json()
  } catch (err) {
    log.error("cron/tick — recheck-velocity failed", { error: String(err) })
    results.recheckVelocity = { error: String(err) }
  }

  // 2. expire stale orders (recheck already rescued any paid ones above)
  try {
    const r = await fetch(`${base}/api/cron/expire-orders`, { method: "POST", headers })
    results.expireOrders = await r.json()
  } catch (err) {
    log.error("cron/tick — expire-orders failed", { error: String(err) })
    results.expireOrders = { error: String(err) }
  }

  // 3. event-reminder (runs every run, only acts on events ~24h away)
  try {
    const r = await fetch(`${base}/api/cron/event-reminder`, { method: "POST", headers })
    results.eventReminder = await r.json()
  } catch (err) {
    log.error("cron/tick — event-reminder failed", { error: String(err) })
    results.eventReminder = { error: String(err) }
  }

  log.info("cron/tick — complete", results)
  return NextResponse.json({ ok: true, ...results })
}
