import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/db"
import { verifyCronSecret } from "@/lib/cron-auth"
import { log } from "@/lib/logger"

/**
 * DELETE past_announce_log rows older than 6 months for events that have ended.
 * Safe to run on every tick — cheap query, returns immediately when nothing qualifies.
 */
export async function POST(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  try {
    const result = await db.execute(sql`
      DELETE FROM past_announce_log pal
      WHERE pal.sent_at < NOW() - INTERVAL '6 months'
        AND EXISTS (
          SELECT 1 FROM events e
          WHERE e.id = pal.event_id
            AND (e.ends_at IS NULL OR e.ends_at < NOW())
        )
    `)

    const deleted = (result as { rowCount?: number }).rowCount ?? 0
    if (deleted > 0) {
      log.info("cron/cleanup-logs — pruned past_announce_log", { deleted })
    }
    return NextResponse.json({ deleted })
  } catch (err) {
    log.error("cron/cleanup-logs — failed", { error: String(err) })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
