import { NextResponse } from "next/server"

import { log } from "@/lib/logger"

/** Public: the new-organiser payout SOP contains no account data. */
export async function GET() {
  try {
    const { generateOrganiserSopPdfBuffer } = await import("@/lib/pdf/organiser-sop-document")
    const pdf = await generateOrganiserSopPdfBuffer()
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="TicketPulse_Organiser_Payout_SOP.pdf"',
        "Content-Length": String(pdf.length),
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (err) {
    log.error("organiser payout sop pdf failed", { error: String(err) })
    return NextResponse.json({ error: "Failed to generate document" }, { status: 500 })
  }
}
