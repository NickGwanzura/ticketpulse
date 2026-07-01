import { NextResponse } from "next/server"
import { z } from "zod"
import { sendSms } from "@/lib/velocity/sms"
import { isKnownTemplate, resolveTemplateId, SMS_TEMPLATES } from "@/lib/velocity/templates"
import { log } from "@/lib/logger"

// ─── Validation schema ───────────────────────────────────────────────────

const SendSmsSchema = z.object({
  template: z.string().min(1),
  recipient: z.string().min(3),
  variables: z.record(z.string()).optional().default({}),
})

// ─── Route ───────────────────────────────────────────────────────────────

/**
 * POST /api/sms/send
 *
 * Send an SMS via VelocityAfrica using a named template.
 *
 * Body:
 * ```json
 * {
 *   "template": "TICKET_CONFIRMATION",
 *   "recipient": "0777816368"
 * }
 * ```
 *
 * Responses:
 * - 200: SMS sent successfully
 * - 400: Validation error
 * - 401: SMS not configured
 * - 500: Unexpected error
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = SendSmsSchema.safeParse(body)

    if (!parsed.success) {
      log.warn("sms — invalid request", { errors: parsed.error.flatten() })
      return NextResponse.json(
        { success: false, error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { template, recipient, variables } = parsed.data

    if (!isKnownTemplate(template)) {
      const known = Object.keys(SMS_TEMPLATES).join(", ")
      return NextResponse.json(
        { success: false, error: `Unknown template "${template}". Known: ${known}` },
        { status: 400 },
      )
    }

    const result = await sendSms(template, recipient, variables)

    return NextResponse.json(result, { status: result.success ? 200 : 207 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error("sms — send failed", { error: msg })

    if (msg.includes("Missing required SMS env vars")) {
      return NextResponse.json({ success: false, error: "SMS not configured" }, { status: 401 })
    }

    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
