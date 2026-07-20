import { NextResponse, after } from "next/server"
import { createHmac, timingSafeEqual } from "node:crypto"
import { handleInboundWhatsAppMessage } from "@/lib/whatsapp-checkout"
import { log } from "@/lib/logger"

type OpenWaWebhookEnvelope = {
  event: string
  timestamp: string
  sessionId: string
  idempotencyKey: string
  deliveryId: string
  data: Record<string, unknown>
}

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex")
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Receives inbound OpenWA webhook deliveries (registered for `message.received`
 * only). Drives the "text EARLYBIRD to buy" WhatsApp checkout flow.
 */
export async function POST(req: Request) {
  const secret = process.env.OPENWA_WEBHOOK_SECRET
  if (!secret) {
    log.error("webhooks/whatsapp — OPENWA_WEBHOOK_SECRET not configured")
    return NextResponse.json({ error: "Not configured" }, { status: 500 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get("x-openwa-signature")

  if (!verifySignature(rawBody, signature, secret)) {
    log.warn("webhooks/whatsapp — invalid signature")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let envelope: OpenWaWebhookEnvelope
  try {
    envelope = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Always 200 quickly — OpenWA retries on non-2xx, and we don't want retries
  // re-processing a message our own reply already triggered on the "from" side.
  if (envelope.event !== "message.received") {
    return NextResponse.json({ ok: true })
  }

  const data = envelope.data
  const chatId = typeof data.from === "string" ? data.from : null
  const body = typeof data.body === "string" ? data.body : ""
  const isGroup = data.isGroup === true

  if (!chatId || isGroup || !body.trim()) {
    return NextResponse.json({ ok: true })
  }

  // Process after responding: OpenWA's delivery timeout is ~10s, and the
  // handler's own replies call back into OpenWA — holding the response open
  // while doing that risks timing the delivery out (and burning its retries).
  after(async () => {
    try {
      await handleInboundWhatsAppMessage(chatId, body)
    } catch (err) {
      log.error("webhooks/whatsapp — handler failed", { chatId, error: err instanceof Error ? err.message : String(err) })
    }
  })

  return NextResponse.json({ ok: true })
}
