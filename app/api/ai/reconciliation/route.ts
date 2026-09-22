import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { generateReconciliationSummary } from "@/lib/groq"
import { getVelocityReconciliationReport } from "@/lib/velocity-reconciliation"
import { rateLimit } from "@/lib/rate-limit"

const aiLimiter = rateLimit({ windowMs: 60_000, max: 10 })

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const rl = await aiLimiter.checkRequest(request)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  try {
    const report = await getVelocityReconciliationReport()
    const result = await generateReconciliationSummary({
      ...report.totals,
      issues: report.orders
        .flatMap((order) => order.issues.map((issue) => ({
          severity: issue.severity,
          title: `${order.eventTitle}: ${issue.title}`,
          detail: issue.detail,
        })))
        .slice(0, 8),
    })
    return NextResponse.json({ summary: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate reconciliation summary"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
