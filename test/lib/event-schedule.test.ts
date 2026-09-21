import { describe, expect, it } from "vitest"

import { isFutureEventStart, parseHarareDateTimeLocal } from "@/lib/event-schedule"

describe("event scheduling", () => {
  it("parses datetime-local values as Africa/Harare time", () => {
    expect(parseHarareDateTimeLocal("2026-10-01T18:30")?.toISOString())
      .toBe("2026-10-01T16:30:00.000Z")
  })

  it("rejects malformed and impossible local dates", () => {
    expect(parseHarareDateTimeLocal("not-a-date")).toBeNull()
    expect(parseHarareDateTimeLocal("2026-02-31T18:30")).toBeNull()
  })

  it("requires an event start to be in the future", () => {
    const now = new Date("2026-09-21T12:00:00.000Z")

    expect(isFutureEventStart(new Date("2026-09-21T12:01:00.000Z"), now)).toBe(true)
    expect(isFutureEventStart(new Date("2026-09-21T12:00:00.000Z"), now)).toBe(false)
    expect(isFutureEventStart(new Date("2026-09-21T11:59:00.000Z"), now)).toBe(false)
  })
})
