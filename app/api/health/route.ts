import { NextResponse } from "next/server"
import { db } from "@/db"
import { sql } from "drizzle-orm"

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

  try {
    // Lightweight ping — `SELECT 1` is the standard DB health check and costs
    // essentially nothing on Neon's serverless Postgres.
    await db.execute(sql`SELECT 1`)
    return NextResponse.json({ status: "ok", timestamp: ts, db: "ok" })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database unreachable"
    return NextResponse.json(
      { status: "error", timestamp: ts, db: "error", message },
      { status: 503 },
    )
  }
}
