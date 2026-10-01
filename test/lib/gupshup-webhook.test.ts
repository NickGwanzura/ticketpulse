import { describe, expect, it } from "vitest"
import { parseGupshupInboundMessage, verifyGupshupWebhookToken } from "@/lib/gupshup-webhook"

describe("Gupshup webhook helpers", () => {
  const secret = "a".repeat(32)

  it("compares the webhook token and rejects missing, short, or incorrect values", () => {
    expect(verifyGupshupWebhookToken(secret, secret)).toBe(true)
    expect(verifyGupshupWebhookToken(`${secret}x`, secret)).toBe(false)
    expect(verifyGupshupWebhookToken(null, secret)).toBe(false)
    expect(verifyGupshupWebhookToken("short", "short")).toBe(false)
  })

  it("extracts text messages from Gupshup's v2 inbound envelope", () => {
    expect(parseGupshupInboundMessage({
      app: "Spiritus",
      type: "message",
      payload: {
        id: "message-123",
        source: "263777816368",
        type: "text",
        payload: { text: "  EVENTS  " },
      },
    })).toEqual({
      app: "Spiritus",
      messageId: "message-123",
      source: "263777816368",
      text: "EVENTS",
    })
  })

  it("supports button and list reply postback text and ignores non-message events", () => {
    expect(parseGupshupInboundMessage({
      app: "Spiritus",
      type: "message",
      payload: { source: "263777816368", type: "list_reply", payload: { postbackText: "2" } },
    })?.text).toBe("2")

    expect(parseGupshupInboundMessage({ app: "Spiritus", type: "message-event", payload: {} })).toBeNull()
    expect(parseGupshupInboundMessage({ app: "Spiritus", type: "message", payload: { source: "263777816368", payload: {} } })).toBeNull()
  })
})
