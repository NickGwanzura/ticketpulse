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

async function invokeCronChild(base: string, path: string, headers: Record<string, string>) {
  const response = await fetch(`${base}${path}`, { method: "POST", headers })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}${payload ? `: ${JSON.stringify(payload).slice(0, 300)}` : ""}`)
  }
  return payload
}

export async function POST(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
  const secret = process.env.CRON_SECRET ?? ""
  const headers = { "Content-Type": "application/json", "x-cron-secret": secret }

  const results: Record<string, unknown> = {}

  // 1. recheck-velocity first — marks paid orders before expire-orders can delete them
  try {
    results.recheckVelocity = await invokeCronChild(base, "/api/cron/recheck-velocity", headers)
  } catch (err) {
    log.error("cron/tick — recheck-velocity failed", { error: String(err) })
    results.recheckVelocity = { error: String(err) }
  }

  // 2. expire stale orders (recheck already rescued any paid ones above)
  try {
    results.expireOrders = await invokeCronChild(base, "/api/cron/expire-orders", headers)
  } catch (err) {
    log.error("cron/tick — expire-orders failed", { error: String(err) })
    results.expireOrders = { error: String(err) }
  }

  // 3. event-reminder (runs every run, only acts on events ~24h away)
  try {
    results.eventReminder = await invokeCronChild(base, "/api/cron/event-reminder", headers)
  } catch (err) {
    log.error("cron/tick — event-reminder failed", { error: String(err) })
    results.eventReminder = { error: String(err) }
  }

  // 4. card-recovery — emails buyers whose card payment has been pending 15 min+
  try {
    results.cardRecovery = await invokeCronChild(base, "/api/cron/card-recovery", headers)
  } catch (err) {
    log.error("cron/tick — card-recovery failed", { error: String(err) })
    results.cardRecovery = { error: String(err) }
  }

  // 5. cleanup-logs — prunes old past_announce_log rows (cheap, returns fast when nothing to do)
  try {
    results.cleanupLogs = await invokeCronChild(base, "/api/cron/cleanup-logs", headers)
  } catch (err) {
    log.error("cron/tick — cleanup-logs failed", { error: String(err) })
    results.cleanupLogs = { error: String(err) }
  }

  // 6. whatsapp-watchdog — daily session health-check (internally gated to 07:00 UTC)
  try {
    results.whatsappWatchdog = await invokeCronChild(base, "/api/cron/whatsapp-watchdog", headers)
  } catch (err) {
    log.error("cron/tick — whatsapp-watchdog failed", { error: String(err) })
    results.whatsappWatchdog = { error: String(err) }
  }

  // 7. reconciliation-digest — daily anomaly summary (internally gated to 08:00 UTC)
  try {
    results.reconciliationDigest = await invokeCronChild(base, "/api/cron/reconciliation-digest", headers)
  } catch (err) {
    log.error("cron/tick — reconciliation-digest failed", { error: String(err) })
    results.reconciliationDigest = { error: String(err) }
  }

  log.info("cron/tick — complete", results)
  return NextResponse.json({ ok: true, ...results })
}
