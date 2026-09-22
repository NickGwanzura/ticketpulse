import { NextResponse } from "next/server"
import { z } from "zod"
import { refreshTokens } from "@/lib/mobile-auth"
import { authLimiter } from "@/lib/rate-limit"

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
})

export async function POST(request: Request) {
  const rl = await authLimiter.checkRequest(request)
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = RefreshSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid refresh token payload" },
      { status: 400 },
    )
  }

  const tokens = await refreshTokens(parsed.data.refreshToken)
  if (!tokens) {
    return NextResponse.json(
      { ok: false, error: "Invalid or expired refresh token" },
      { status: 401 },
    )
  }

  return NextResponse.json({ ok: true, ...tokens })
}
