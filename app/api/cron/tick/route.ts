/**
 * Combined cron entry point — call this every minute from Dokploy (or any
 * external scheduler) with the CRON_SECRET header.
 *
 * Runs all cron jobs in the correct dependency order:
 *   1. recheck-velocity  — confirms pending payments before anything expires
 *   2. expire-orders     — expires stale orders (safe now that paid ones are caught above)
 *
 * Dokploy cron setup:
 *   Create a cron job in the Dokploy dashboard:
 *     Schedule:  * * * * *   (every minute)
 *     Command:   curl -X POST https://ticketpulse.tech/api/cron/tick \
 *                     -H "x-cron-secret: $CRON_SECRET"
 */
import { NextResponse } from "next/server"
import { verifyCronSecret } from "@/lib/cron-auth"
import { log } from "@/lib/logger"
import { recordHeartbeatError, recordHeartbeatSuccess } from "@/lib/system-heartbeats"

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
  const failed: string[] = []

  const jobs = [
    { key: "recheckVelocity", path: "/api/cron/recheck-velocity", critical: true },
    { key: "expireOrders", path: "/api/cron/expire-orders", critical: true },
    { key: "eventReminder", path: "/api/cron/event-reminder", critical: false },
    { key: "cardRecovery", path: "/api/cron/card-recovery", critical: false },
    { key: "paymentFollowups", path: "/api/cron/payment-followups", critical: false },
    { key: "cleanupLogs", path: "/api/cron/cleanup-logs", critical: false },
    { key: "whatsappWatchdog", path: "/api/cron/whatsapp-watchdog", critical: false },
    { key: "reconciliationDigest", path: "/api/cron/reconciliation-digest", critical: false },
  ] as const

  // Preserve dependency order: payment recheck must finish before expiry.
  for (const job of jobs) {
    const heartbeatKey = `cron:${job.key}`
    try {
      results[job.key] = await invokeCronChild(base, job.path, headers)
      await recordHeartbeatSuccess(heartbeatKey)
    } catch (error) {
      const message = String(error)
      failed.push(job.key)
      results[job.key] = { error: message }
      log.error(`cron/tick — ${job.key} failed`, { error: message })
      await recordHeartbeatError(heartbeatKey, error)
    }
  }

  const criticalFailed = jobs.some((job) => job.critical && failed.includes(job.key))
  if (failed.length === 0) await recordHeartbeatSuccess("cron:tick")
  else await recordHeartbeatError("cron:tick", `Failed jobs: ${failed.join(", ")}`)

  log.info("cron/tick — complete", { failed, results })
  return NextResponse.json(
    { ok: failed.length === 0, failed, ...results },
    { status: criticalFailed ? 503 : 200 },
  )
}
