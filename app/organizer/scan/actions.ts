"use server"

import { auth } from "@/auth"
import { markTicketScanned, type ScanResult } from "@/lib/ticket-scan"
import { headers } from "next/headers"

export type { ScanResult }

export async function markTicketScannedAction(rawCode: string, eventId?: string): Promise<ScanResult> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "Not authenticated" }

  const requestHeaders = await headers()
  return markTicketScanned(rawCode, {
    eventId: eventId ?? null,
    scannerUserId: session.user.id,
    source: "organizer_web",
    userAgent: requestHeaders.get("user-agent"),
    ipAddress: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? requestHeaders.get("x-real-ip"),
  })
}
