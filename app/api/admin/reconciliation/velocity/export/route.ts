import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { generateReconciliationPdfBuffer } from "@/lib/pdf/reconciliation"
import { getVelocityReconciliationReport, velocityReconciliationToCsv } from "@/lib/velocity-reconciliation"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const format = new URL(request.url).searchParams.get("format") === "pdf" ? "pdf" : "csv"
  const report = await getVelocityReconciliationReport()
  const stamp = report.generatedAt.toISOString().slice(0, 10)

  if (format === "pdf") {
    const pdf = await generateReconciliationPdfBuffer(report)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="velocity-reconciliation-${stamp}.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  }

  const csv = velocityReconciliationToCsv(report)
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="velocity-reconciliation-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
