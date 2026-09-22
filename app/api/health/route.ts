import { NextResponse } from "next/server"
import { db } from "@/db"
import { inArray, sql } from "drizzle-orm"
import { systemHeartbeats } from "@/db/schema"
import { log } from "@/lib/logger"

const CRITICAL_HEARTBEATS = ["cron:tick", "cron:recheckVelocity", "cron:expireOrders"]
const HEARTBEAT_STALE_MS = 10 * 60 * 1000

/**
 * Minimal health-check endpoint.
 *
 * Returns 200 when the server is alive and the database is reachable.
 * Returns 503 if the DB ping fails — useful for load-balancer probes and
 * monitoring (e.g. Better Uptime, Pingdom, Railway health checks).
 *
 * Response shape:
 * ```json
 * { "status": "ok", "timestamp": "2026-05-20T17:00:00.000Z", "db": "ok" }
 * ```
 * or on failure:
 * ```json
 * { "status": "error", "timestamp": "...", "db": "error", "message": "..." }
 * ```
 */
export async function GET() {
  const ts = new Date().toISOString()
  const startedAt = Date.now()

  try {
    // Lightweight ping — `SELECT 1` is the standard DB health check and costs
    // essentially nothing on Neon's serverless Postgres.
    await db.execute(sql`SELECT 1`)

    let staleHeartbeats: string[] = []
    try {
      const rows = await db
        .select({
          key: systemHeartbeats.key,
          lastSuccessAt: systemHeartbeats.lastSuccessAt,
          lastErrorAt: systemHeartbeats.lastErrorAt,
        })
        .from(systemHeartbeats)
        .where(inArray(systemHeartbeats.key, CRITICAL_HEARTBEATS))

      const byKey = new Map(rows.map((row) => [row.key, row]))
      staleHeartbeats = CRITICAL_HEARTBEATS.filter((key) => {
        const row = byKey.get(key)
        if (!row?.lastSuccessAt) return true
        const stale = Date.now() - row.lastSuccessAt.getTime() > HEARTBEAT_STALE_MS
        const latestRunFailed = !!row.lastErrorAt && row.lastErrorAt > row.lastSuccessAt
        return stale || latestRunFailed
      })
    } catch (error) {
      staleHeartbeats = [...CRITICAL_HEARTBEATS]
      log.warn("health check could not read heartbeats", { error: String(error) })
    }

    return NextResponse.json({
      status: staleHeartbeats.length > 0 ? "degraded" : "ok",
      timestamp: ts,
      db: "ok",
      cron: staleHeartbeats.length > 0 ? "degraded" : "ok",
      staleHeartbeats,
      latencyMs: Date.now() - startedAt,
    })
  } catch (err) {
    log.error("health check database failure", { error: String(err) })
    return NextResponse.json(
      { status: "error", timestamp: ts, db: "error", message: "Database unreachable" },
      { status: 503 },
    )
  }
}
