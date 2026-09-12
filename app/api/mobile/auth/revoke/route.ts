import { NextResponse } from "next/server"
import { z } from "zod"
import { revokeRefreshToken } from "@/lib/mobile-auth"

const Schema = z.object({ refreshToken: z.string().min(1) })

export async function POST(request: Request) {
  const parsed = Schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid refresh token payload" }, { status: 400 })
  await revokeRefreshToken(parsed.data.refreshToken)
  return NextResponse.json({ ok: true })
}
