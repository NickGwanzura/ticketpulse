// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/r2", () => ({ uploadPublicObject: vi.fn() }))
vi.mock("@/lib/logger", () => ({ log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

import { formatChatId, getWhatsAppHealth, maskPhone, sendText } from "@/lib/whatsapp"

const OK = { messageId: "m1", timestamp: 1 }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(() => {
  vi.stubEnv("OPENWA_URL", "https://openwa.test")
  vi.stubEnv("OPENWA_API_KEY", "key")
  vi.stubEnv("OPENWA_SESSION_ID", "sess")
  vi.stubEnv("WHATSAPP_PROVIDER", "openwa")
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

async function send(fetchImpl: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchImpl)
  const promise = sendText("263771234567@c.us", "hi").then((v) => ({ ok: true as const, v }), (e) => ({ ok: false as const, e }))
  await vi.runAllTimersAsync()
  return promise
}

describe("OpenWA retries", () => {
  it("retries a refused connection and then succeeds", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(json(OK))
    const result = await send(fetchMock)
    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("retries a 503 from a proxy", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json(OK))
    expect((await send(fetchMock)).ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not retry a timeout, so a slow gateway cannot send duplicates", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" })
    const fetchMock = vi.fn().mockRejectedValue(timeout)
    const result = await send(fetchMock)
    expect(result.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not retry a 4xx/500 application error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ error: "bad" }, 500))
    const result = await send(fetchMock)
    expect(result.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("gives up after three attempts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}, 502))
    const result = await send(fetchMock)
    expect(result.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

describe("helpers", () => {
  it("formats Zimbabwe numbers into chat ids", () => {
    expect(formatChatId("0771234567")).toBe("263771234567@c.us")
    expect(formatChatId("+263 77 123 4567")).toBe("263771234567@c.us")
    expect(formatChatId("+27 82 123 4567")).toBe("27821234567@c.us")
  })

  it("masks phone numbers for logs", () => {
    expect(maskPhone("+263 77 123 4567")).toBe("*********567")
  })
})

describe("getWhatsAppHealth", () => {
  it("reports not configured without settings", async () => {
    vi.stubEnv("OPENWA_URL", "")
    expect((await getWhatsAppHealth()).tone).toBe("bad")
  })

  it("reports connected when the session is ready", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ id: "s", name: "n", status: "ready", phone: "263771234567" })))
    const health = await getWhatsAppHealth()
    expect(health.tone).toBe("ok")
  })

  it("asks for a QR scan when logged out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ id: "s", name: "n", status: "qr_ready", phone: null })))
    expect((await getWhatsAppHealth()).value).toMatch(/QR/)
  })

  it("reports unreachable when the gateway is gone", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")))
    const promise = getWhatsAppHealth()
    await vi.runAllTimersAsync()
    expect((await promise).tone).toBe("bad")
  })
})
