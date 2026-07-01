import { NextResponse } from "next/server"
import { sendTicketConfirmationSms, sendEventReminderSms } from "@/lib/sms"
import { log } from "@/lib/logger"

/**
 * POST /api/sms/test
 *
 * Sends a test SMS to an arbitrary phone number.
 * Body: { phone: string, template?: "confirmation" | "reminder" }
 *
 * Phone format: local Zim format (e.g. 0777816368) or international (+263...)
 */
export async function POST(req: Request) {
  try {
    const { phone, template = "confirmation" } = await req.json()

    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "phone is required" }, { status: 400 })
    }

    const digits = phone.replace(/\D/g, "")
    if (digits.length < 9) {
      return NextResponse.json({ error: "phone number too short" }, { status: 400 })
    }

    let result
    if (template === "reminder") {
      result = await sendEventReminderSms(phone)
    } else {
      result = await sendTicketConfirmationSms(phone)
    }

    log.info("sms — test sent", { phone, template, batchId: result.result })

    return NextResponse.json({
      ok: true,
      sentTo: phone,
      template,
      batchId: result.result,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error("sms — test failed", { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
