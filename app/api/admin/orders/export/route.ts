import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { generateOrdersReconPdfBuffer } from "@/lib/pdf/orders-report"
import { getOrdersReconReport } from "@/lib/orders-recon-report"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const params = new URL(request.url).searchParams
  const report = await getOrdersReconReport({
    title: "Platform orders reconciliation",
    scope: "All platform orders",
    generatedBy: session.user.email ?? session.user.name ?? "admin",
    search: params.get("q") ?? undefined,
    status: params.get("status") ?? "all",
  })
  const stamp = report.generatedAt.toISOString().slice(0, 10)
  const pdf = await generateOrdersReconPdfBuffer(report)

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="orders-reconciliation-${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
