import { NextResponse } from "next/server"
import { verifyCronSecret } from "@/lib/cron-auth"
import { log } from "@/lib/logger"
import { processPayoutNotificationDeliveries } from "@/lib/payout-notification-outbox"

export async function POST(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  try {
    const result = await processPayoutNotificationDeliveries()
    log.info("Payout notification outbox processed", result)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    log.error("Payout notification outbox failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    })
    return NextResponse.json({ ok: false, error: "payout_notifications_failed" }, { status: 500 })
  }
}
