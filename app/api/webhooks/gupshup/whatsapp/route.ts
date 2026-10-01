import { after } from "next/server"
import { formatChatId } from "@/lib/whatsapp"
import { handleInboundWhatsAppMessage } from "@/lib/whatsapp-checkout"
import { log } from "@/lib/logger"
import { parseGupshupInboundMessage, verifyGupshupWebhookToken } from "@/lib/gupshup-webhook"

export const runtime = "nodejs"

/** Receives Gupshup message callbacks and hands text replies to ticket checkout. */
export async function POST(request: Request) {
  const secret = process.env.GUPSHUP_WEBHOOK_SECRET
  if (!secret || secret.length < 32) {
    log.error("webhooks/gupshup/whatsapp — GUPSHUP_WEBHOOK_SECRET is missing or too short")
    return new Response(null, { status: 503 })
  }

  const suppliedToken = new URL(request.url).searchParams.get("token")
  if (!verifyGupshupWebhookToken(suppliedToken, secret)) {
    log.warn("webhooks/gupshup/whatsapp — invalid webhook token")
    return new Response(null, { status: 401 })
  }

  let envelope: unknown
  try {
    envelope = await request.json()
  } catch {
    log.warn("webhooks/gupshup/whatsapp — invalid JSON callback")
    return new Response(null, { status: 200 })
  }

  const message = parseGupshupInboundMessage(envelope)
  if (!message) return new Response(null, { status: 200 })

  const appName = process.env.GUPSHUP_APP_NAME?.trim()
  if (!appName || message.app !== appName) {
    log.warn("webhooks/gupshup/whatsapp — callback app does not match configured Gupshup app")
    return new Response(null, { status: 200 })
  }

  let chatId: string
  try {
    chatId = formatChatId(message.source)
  } catch {
    log.warn("webhooks/gupshup/whatsapp — invalid inbound sender number")
    return new Response(null, { status: 200 })
  }

  after(async () => {
    try {
      await handleInboundWhatsAppMessage(chatId, message.text)
    } catch (error) {
      log.error("webhooks/gupshup/whatsapp — message handler failed", {
        messageId: message.messageId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })

  // Gupshup expects an immediate empty 2xx acknowledgment; handle the message
  // after the response so its callback delivery does not wait on checkout work.
  return new Response(null, { status: 200 })
}
