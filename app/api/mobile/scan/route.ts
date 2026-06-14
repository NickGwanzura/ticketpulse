import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { markTicketScanned } from "@/lib/ticket-scan"
import { apiLimiter } from "@/lib/rate-limit"

const ScanSchema = z.object({
  code: z.string().min(1).max(2000),
})

export async function POST(req: Request) {
  const rl = apiLimiter.checkRequest(req)
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }

  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = ScanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid scan payload" }, { status: 400 })
  }

  const result = await markTicketScanned(parsed.data.code)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
