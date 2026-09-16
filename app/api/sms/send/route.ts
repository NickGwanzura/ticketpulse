import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { z } from "zod"
import { sendSms } from "@/lib/velocity/sms"
import { isKnownTemplate, SMS_TEMPLATES } from "@/lib/velocity/templates"
import { log } from "@/lib/logger"
import { auth } from "@/auth"

// ─── Validation schema ───────────────────────────────────────────────────

const SendSmsSchema = z.object({
  template: z.string().min(1),
  recipient: z.string().min(3),
})

// ─── Auth ────────────────────────────────────────────────────────────────

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

/**
 * Sending SMS costs money per message, so this endpoint is restricted to
 * server-to-server callers holding INTERNAL_API_KEY, or an admin session.
 * It previously accepted anonymous requests, which allowed arbitrary
 * billable sends to any number (toll fraud).
 */
async function isAuthorized(req: Request): Promise<boolean> {
  const internalKey = process.env.INTERNAL_API_KEY
  const provided = req.headers.get("x-internal-key")
  if (internalKey && provided && constantTimeEqual(provided, internalKey)) return true

  const session = await auth()
  return session?.user?.role === "admin"
}

// ─── Route ───────────────────────────────────────────────────────────────

/**
 * POST /api/sms/send
 *
 * Send an SMS via VelocityAfrica using a named template.
 * Requires `x-internal-key: $INTERNAL_API_KEY` or an admin session.
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
 * - 401: Unauthorized / SMS not configured
 * - 500: Unexpected error
 */
export async function POST(req: Request) {
  try {
    if (!(await isAuthorized(req))) {
      log.warn("sms — rejected unauthorised send attempt")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const parsed = SendSmsSchema.safeParse(body)

    if (!parsed.success) {
      log.warn("sms — invalid request", { errors: parsed.error.flatten() })
      return NextResponse.json(
        { success: false, error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { template, recipient } = parsed.data

    if (!isKnownTemplate(template)) {
      const known = Object.keys(SMS_TEMPLATES).join(", ")
      return NextResponse.json(
        { success: false, error: `Unknown template "${template}". Known: ${known}` },
        { status: 400 },
      )
    }

    const result = await sendSms(template, recipient)

    return NextResponse.json(result, { status: result.success ? 200 : 207 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error("sms — send failed", { error: msg })

    if (msg.includes("No SMS credentials configured")) {
      return NextResponse.json({ success: false, error: "SMS not configured" }, { status: 401 })
    }

    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
