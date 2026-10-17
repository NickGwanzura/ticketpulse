// @vitest-environment node
import { createHmac } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"

const handler = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock("server-only", () => ({}))
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (fn: () => unknown) => { void fn() },
}))
vi.mock("@/lib/whatsapp-checkout", () => ({ handleInboundWhatsAppMessage: handler }))
vi.mock("@/lib/logger", () => ({ log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

import { POST } from "@/app/api/webhooks/whatsapp/route"

const SECRET = "test-secret"
let counter = 0

function request(body: Record<string, unknown>, opts: { secret?: string; signature?: string } = {}) {
  const raw = JSON.stringify(body)
  const signature = opts.signature ?? "sha256=" + createHmac("sha256", opts.secret ?? SECRET).update(raw).digest("hex")
  return new Request("https://app.test/api/webhooks/whatsapp", { method: "POST", body: raw, headers: { "x-openwa-signature": signature } })
}

function message(overrides: Record<string, unknown> = {}, from = `2637712345${++counter}@c.us`) {
  return {
    event: "message.received",
    timestamp: new Date().toISOString(),
    sessionId: "s",
    idempotencyKey: `idem-${++counter}-${Math.random()}`,
    deliveryId: `del-${counter}`,
    data: { from, body: "EARLYBIRD", isGroup: false },
    ...overrides,
  }
}

beforeEach(() => {
  handler.mockClear()
  vi.stubEnv("OPENWA_WEBHOOK_SECRET", SECRET)
})

describe("POST /api/webhooks/whatsapp", () => {
  it("returns 500 when the secret is not configured", async () => {
    vi.stubEnv("OPENWA_WEBHOOK_SECRET", "")
    expect((await POST(request(message()))).status).toBe(500)
  })

  it("rejects a bad signature", async () => {
    const res = await POST(request(message(), { secret: "wrong" }))
    expect(res.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it("passes a signed message to the checkout handler", async () => {
    const res = await POST(request(message()))
    expect(res.status).toBe(200)
    await Promise.resolve()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("ignores a redelivered message", async () => {
    const body = message()
    expect((await POST(request(body))).status).toBe(200)
    const again = await POST(request(body))
    expect(await again.json()).toMatchObject({ duplicate: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("ignores group chats and other events", async () => {
    await POST(request(message({ data: { from: "1@g.us", body: "hi", isGroup: true } })))
    await POST(request(message({ event: "message.ack" })))
    expect(handler).not.toHaveBeenCalled()
  })

  it("caps how fast one sender can drive the bot", async () => {
    const from = "263779999999@c.us"
    for (let i = 0; i < 25; i++) await POST(request(message({}, from)))
    expect(handler.mock.calls.length).toBe(20)
  })
})
