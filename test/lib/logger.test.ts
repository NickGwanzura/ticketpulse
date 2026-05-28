import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

describe("logger", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("logs info message as JSON", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const { log } = await import("@/lib/logger")
    log.info("hello world", { userId: "abc" })

    const call = (console.log as ReturnType<typeof vi.spyOn>).mock.calls[0]?.[0]
    expect(call).toBeTruthy()
    const parsed = JSON.parse(call)
    expect(parsed.level).toBe("info")
    expect(parsed.message).toBe("hello world")
    expect(parsed.meta).toEqual({ userId: "abc" })
  })

  it("logs error via console.error", async () => {
    vi.stubEnv("NODE_ENV", "development")

    const { log } = await import("@/lib/logger")
    log.error("something broke", { code: 500 })

    expect(console.error).toHaveBeenCalledTimes(1)
    const call = (console.error as ReturnType<typeof vi.spyOn>).mock.calls[0]?.[0]
    const parsed = JSON.parse(call)
    expect(parsed.level).toBe("error")
    expect(parsed.message).toBe("something broke")
  })

  it("logs warn via console.warn", async () => {
    vi.stubEnv("NODE_ENV", "development")

    const { log } = await import("@/lib/logger")
    log.warn("deprecated", { feature: "old-thing" })

    expect(console.warn).toHaveBeenCalledTimes(1)
    const call = (console.warn as ReturnType<typeof vi.spyOn>).mock.calls[0]?.[0]
    const parsed = JSON.parse(call)
    expect(parsed.level).toBe("warn")
  })

  it("suppresses debug in production", async () => {
    vi.stubEnv("NODE_ENV", "production")

    const { log } = await import("@/lib/logger")
    log.debug("should not appear")

    expect(console.log).not.toHaveBeenCalled()
  })

  it("allows info in production", async () => {
    vi.stubEnv("NODE_ENV", "production")

    const { log } = await import("@/lib/logger")
    log.info("should appear")

    expect(console.log).toHaveBeenCalledTimes(1)
  })

  it("logs without meta", async () => {
    vi.stubEnv("NODE_ENV", "development")

    const { log } = await import("@/lib/logger")
    log.info("bare message")

    const call = (console.log as ReturnType<typeof vi.spyOn>).mock.calls[0]?.[0]
    const parsed = JSON.parse(call)
    expect(parsed.meta).toBeUndefined()
    expect(parsed.message).toBe("bare message")
  })
})
