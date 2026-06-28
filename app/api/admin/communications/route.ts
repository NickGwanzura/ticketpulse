import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { sendCommunicationAction } from "@/app/admin/actions/communications"
import { rateLimit } from "@/lib/rate-limit"

const commsLimiter = rateLimit({ windowMs: 60_000, max: 10 })

export async function POST(req: NextRequest) {
  const rl = commsLimiter.checkRequest(req)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { audience, channels, subject, body } = await req.json()

    if (!audience || !channels?.length || !subject?.trim() || !body?.trim()) {
      return NextResponse.json(
        { error: "audience, channels, subject, and body are required" },
        { status: 400 },
      )
    }

    const formData = new FormData()
    formData.set("audience", audience)
    formData.set("channels", channels.join(","))
    formData.set("subject", subject)
    formData.set("body", body)

    const results = await sendCommunicationAction(formData)

    return NextResponse.json({ results })
  } catch (err) {
    console.error("[admin/communications] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send communication" },
      { status: 500 },
    )
  }
}
