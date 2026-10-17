import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { buildPayoutStatementData } from "@/lib/payout-statement-data"
import { log } from "@/lib/logger"

/**
 * Organiser-facing financial statement: the itemized summary and payout
 * ledger an organiser needs for their own accounting.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const requestedUserId = url.searchParams.get("userId")
  const userId = requestedUserId && session.user.role === "admin" ? requestedUserId : session.user.id

  // Optional ledger period (YYYY-MM-DD). Summary figures are always all-time.
  const parseDay = (value: string | null, endOfDay: boolean) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`)
    return Number.isNaN(d.getTime()) ? null : d
  }

  try {
    const data = await buildPayoutStatementData(userId, {
      from: parseDay(url.searchParams.get("from"), false),
      to: parseDay(url.searchParams.get("to"), true),
    })
    if (!data) return NextResponse.json({ error: "Organizer not found" }, { status: 404 })

    const { generatePayoutStatementPdfBuffer } = await import("@/lib/pdf/payout-statement-document")
    const pdfBuffer = await generatePayoutStatementPdfBuffer(data)

    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="TicketPulse_Payout_Statement_${date}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    })
  } catch (err) {
    log.error("payout statement pdf generation failed", { error: String(err) })
    return NextResponse.json({ error: "Failed to generate statement" }, { status: 500 })
  }
}
