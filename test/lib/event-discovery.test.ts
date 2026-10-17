import { describe, expect, it } from "vitest"
import { nextHarareDate, parseDiscoveryDate, parseDiscoveryPrice, safeEventReturnTo } from "@/lib/event-discovery"

describe("event discovery filters", () => {
  it("accepts valid date inputs and rejects impossible calendar dates", () => {
    expect(parseDiscoveryDate("2026-10-31")?.toISOString()).toBe("2026-10-30T22:00:00.000Z")
    expect(parseDiscoveryDate("2026-02-30")).toBeNull()
    expect(parseDiscoveryDate("not-a-date")).toBeNull()
  })

  it("uses inclusive Harare end dates", () => {
    const start = parseDiscoveryDate("2026-10-31")!
    expect(nextHarareDate(start).toISOString()).toBe("2026-10-31T22:00:00.000Z")
  })

  it("accepts only bounded non-negative price filters", () => {
    expect(parseDiscoveryPrice("0")).toBe(0)
    expect(parseDiscoveryPrice("45.50")).toBe(45.5)
    expect(parseDiscoveryPrice("-1")).toBeNull()
    expect(parseDiscoveryPrice("1000001")).toBeNull()
    expect(parseDiscoveryPrice("abc")).toBeNull()
  })

  it("keeps return links on the local events route", () => {
    expect(safeEventReturnTo("/events?city=Harare")).toBe("/events?city=Harare")
    expect(safeEventReturnTo("https://example.com")).toBe("/events")
    expect(safeEventReturnTo("//example.com")).toBe("/events")
  })
})
