import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { log } from "@/lib/logger"
import { buildPayoutReceiptData } from "@/lib/payout-completion"

/** PDF receipt for a paid payout. Owner or admin only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const data = await buildPayoutReceiptData(id)
    // 404 (not 403) for other people's payouts so ids can't be probed.
    if (!data || (data.userId !== session.user.id && session.user.role !== "admin")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const { generatePayoutReceiptPdfBuffer } = await import("@/lib/pdf/payout-receipt-document")
    const pdf = await generatePayoutReceiptPdfBuffer(data)
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="TicketPulse_Payout_Receipt_${data.payoutReference}.pdf"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "private, no-store",
      },
    })
  } catch (err) {
    log.error("payout receipt pdf failed", { payoutId: id, error: String(err) })
    return NextResponse.json({ error: "Failed to generate receipt" }, { status: 500 })
  }
}
