"use server"

import { auth } from "@/auth"
import { markTicketScanned, type ScanResult } from "@/lib/ticket-scan"

export type { ScanResult }

export async function markTicketScannedAction(rawCode: string): Promise<ScanResult> {
  const session = await auth()
  if (!session) return { ok: false, error: "Not authenticated" }

  return markTicketScanned(rawCode)
}
