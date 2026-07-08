import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { getPlatformKeyStats } from "@/lib/key-stats"
import { log } from "@/lib/logger"

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const stats = await getPlatformKeyStats()

    const { generateKeyStatsPdfBuffer } = await import("@/lib/pdf/key-stats-document")
    const pdfBuffer = await generateKeyStatsPdfBuffer(stats)

    const date = stats.generatedAt.toISOString().slice(0, 10)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="TicketPulse_Key_Stats_${date}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    })
  } catch (err) {
    log.error("key-stats pdf generation failed", { error: String(err) })
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}
