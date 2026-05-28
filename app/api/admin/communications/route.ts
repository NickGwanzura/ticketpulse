import { NextRequest, NextResponse } from "next/server"
import { sendCommunicationAction } from "@/app/admin/actions"

export async function POST(req: NextRequest) {
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
