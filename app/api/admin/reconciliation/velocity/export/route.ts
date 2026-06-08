import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { getVelocityReconciliationReport, velocityReconciliationToCsv } from "@/lib/velocity-reconciliation"

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const report = await getVelocityReconciliationReport()
  const csv = velocityReconciliationToCsv(report)
  const stamp = report.generatedAt.toISOString().slice(0, 10)

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="velocity-reconciliation-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
