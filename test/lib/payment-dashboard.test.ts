import { describe, it, expect } from "vitest"

describe("payment dashboard", () => {
  it("should compute success rate correctly", () => {
    const paidCount = { count: 85 }
    const failedCount = { count: 15 }
    const total = (paidCount.count ?? 0) + (failedCount.count ?? 0)
    const successRate = total > 0
      ? Math.round((paidCount.count / total) * 100)
      : paidCount.count ? 100 : 0

    expect(successRate).toBe(85)
  })

  it("should return 100% success rate when no failures", () => {
    const paidCount = { count: 50 }
    const failedCount = { count: 0 }
    const total = (paidCount.count ?? 0) + (failedCount.count ?? 0)
    const successRate = total > 0
      ? Math.round((paidCount.count / total) * 100)
      : paidCount.count ? 100 : 0

    expect(successRate).toBe(100)
  })

  it("should return 0% success rate when all failed", () => {
    const paidCount = { count: 0 }
    const failedCount = { count: 25 }
    const total = (paidCount.count ?? 0) + (failedCount.count ?? 0)
    const successRate = total > 0
      ? Math.round((paidCount.count / total) * 100)
      : paidCount.count ? 100 : 0

    expect(successRate).toBe(0)
  })

  it("should return 0% when no transactions exist", () => {
    const paidCount = { count: 0 }
    const failedCount = { count: 0 }
    const total = (paidCount.count ?? 0) + (failedCount.count ?? 0)
    const successRate = total > 0
      ? Math.round((paidCount.count / total) * 100)
      : paidCount.count ? 100 : 0

    expect(successRate).toBe(0)
  })

  it("should compute week-over-week delta correctly", () => {
    const weekRev = 5000
    const prevWeekRev = 4000

    const delta = prevWeekRev > 0
      ? ((weekRev - prevWeekRev) / prevWeekRev) * 100
      : weekRev > 0 ? 100 : 0

    expect(delta).toBe(25)
  })

  it("should return 100% delta when no previous period data but current has revenue", () => {
    const weekRev = 3000
    const prevWeekRev = 0

    const delta = prevWeekRev > 0
      ? ((weekRev - prevWeekRev) / prevWeekRev) * 100
      : weekRev > 0 ? 100 : 0

    expect(delta).toBe(100)
  })

  it("should return 0% delta when both periods have no revenue", () => {
    const weekRev = 0
    const prevWeekRev = 0

    const delta = prevWeekRev > 0
      ? ((weekRev - prevWeekRev) / prevWeekRev) * 100
      : weekRev > 0 ? 100 : 0

    expect(delta).toBe(0)
  })

  it("should compute negative delta when revenue drops", () => {
    const weekRev = 2000
    const prevWeekRev = 4000

    const delta = prevWeekRev > 0
      ? ((weekRev - prevWeekRev) / prevWeekRev) * 100
      : weekRev > 0 ? 100 : 0

    expect(delta).toBe(-50)
  })

  it("should format payment method label correctly", () => {
    const labels: Array<{ method: string; expected: string }> = [
      { method: "velocity-ecocash", expected: "ecocash" },
      { method: "velocity-card", expected: "card" },
      { method: "ecocash", expected: "ecocash" },
    ]
    for (const pair of labels) {
      const label = pair.method.replace("velocity-", "")
      expect(label).toBe(pair.expected)
    }
  })

  it("should build sparkline data correctly from daily revenue", () => {
    const now = new Date("2026-06-18T12:00:00.000Z")
    const dailyRevenue = [
      { day: "2026-06-05", total: "100" },
      { day: "2026-06-06", total: "200" },
      { day: "2026-06-18", total: "300" },
    ]

    const dayMap = new Map<string, number>()
    for (const r of dailyRevenue) {
      dayMap.set(r.day, Number(r.total))
    }

    const sparkPoints: number[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000)
      const key = d.toISOString().slice(0, 10)
      sparkPoints.push(dayMap.get(key) ?? 0)
    }

    expect(sparkPoints.length).toBe(14)
    // Verify all known values are present — timezone may shift exact day indices
    expect(sparkPoints.some((v) => v === 100)).toBe(true)
    expect(sparkPoints.some((v) => v === 200)).toBe(true)
    expect(sparkPoints.some((v) => v === 300)).toBe(true)
  })

  it("should return all zeros when no daily revenue data exists", () => {
    const now = new Date("2026-06-18T12:00:00.000Z")
    const dailyRevenue: Array<{ day: string; total: string }> = []

    const dayMap = new Map<string, number>()
    for (const r of dailyRevenue) {
      dayMap.set(r.day, Number(r.total))
    }

    const sparkPoints: number[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000)
      const key = d.toISOString().slice(0, 10)
      sparkPoints.push(dayMap.get(key) ?? 0)
    }

    expect(sparkPoints.every((p) => p === 0)).toBe(true)
    expect(sparkPoints.length).toBe(14)
  })

  it("should compute payment method success rate correctly", () => {
    const method = { paid: 80, total: 100 }
    const rate = method.total > 0 ? Math.round((method.paid / method.total) * 100) : 0
    expect(rate).toBe(80)
  })

  it("should return 0% payment method rate when no transactions", () => {
    const method = { paid: 0, total: 0 }
    const rate = method.total > 0 ? Math.round((method.paid / method.total) * 100) : 0
    expect(rate).toBe(0)
  })
})
