import { timingSafeEqual } from "node:crypto"

export type GupshupInboundMessage = {
  app: string
  messageId: string | null
  source: string
  text: string
}

export function verifyGupshupWebhookToken(received: string | null, expected: string): boolean {
  if (!received || expected.length < 32) return false
  const receivedBytes = Buffer.from(received)
  const expectedBytes = Buffer.from(expected)
  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes)
}

/** Parse Gupshup's v2 inbound message envelope; status/user events are ignored. */
export function parseGupshupInboundMessage(value: unknown): GupshupInboundMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const envelope = value as Record<string, unknown>
  if (envelope.type !== "message") return null
  if (typeof envelope.app !== "string" || !envelope.app.trim()) return null

  const payload = envelope.payload
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null
  const message = payload as Record<string, unknown>
  const source = typeof message.source === "string" ? message.source : ""
  if (!source) return null

  const content = message.payload
  let text = ""
  if (typeof content === "string") {
    text = content
  } else if (content && typeof content === "object" && !Array.isArray(content)) {
    const body = content as Record<string, unknown>
    for (const candidate of [body.text, body.postbackText, body.reply, body.title]) {
      if (typeof candidate === "string" && candidate.trim()) {
        text = candidate
        break
      }
    }
  }

  if (!text.trim()) return null
  return {
    app: envelope.app,
    messageId: typeof message.id === "string" ? message.id : null,
    source,
    text: text.trim(),
  }
}
