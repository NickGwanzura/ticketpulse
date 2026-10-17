import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  event: null as { id: string } | null,
  questions: [] as Array<{ id: string; question: string; required: boolean; sortOrder: number }>,
  selectCount: 0,
  allowed: true,
  retryAfterMs: 0,
}))

vi.mock("@/db", () => ({
  db: {
    select: () => {
      const selectIndex = state.selectCount++
      return {
        from: () => ({
          where: () => ({
            limit: async () => selectIndex === 0 ? (state.event ? [state.event] : []) : [],
            orderBy: async () => state.questions,
          }),
        }),
      }
    },
  },
}))

vi.mock("@/db/schema", () => ({
  events: { id: "events.id", slug: "events.slug", status: "events.status" },
  ticketQuestions: {
    id: "ticketQuestions.id",
    question: "ticketQuestions.question",
    required: "ticketQuestions.required",
    sortOrder: "ticketQuestions.sortOrder",
    eventId: "ticketQuestions.eventId",
  },
}))

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ and: conditions }),
  asc: (column: unknown) => ({ asc: column }),
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
}))

vi.mock("@/lib/rate-limit", () => ({
  apiLimiter: {
    checkRequest: vi.fn(async () => ({
      allowed: state.allowed,
      remaining: state.allowed ? 29 : 0,
      resetMs: Date.now() + state.retryAfterMs,
      retryAfterMs: state.retryAfterMs,
    })),
  },
}))

describe("checkout questions endpoint", () => {
  beforeEach(() => {
    state.event = { id: "event-1" }
    state.questions = [{ id: "question-1", question: "Dietary needs?", required: false, sortOrder: 0 }]
    state.selectCount = 0
    state.allowed = true
    state.retryAfterMs = 0
  })

  it("returns questions for a published event", async () => {
    const { GET } = await import("@/app/api/checkout/questions/route")
    const response = await GET(new Request("https://ticketpulse.tech/api/checkout/questions?eventSlug=summer-fest"))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ questions: state.questions })
    expect(state.selectCount).toBe(2)
  })

  it("rejects a missing or oversized event slug", async () => {
    const { GET } = await import("@/app/api/checkout/questions/route")
    const missing = await GET(new Request("https://ticketpulse.tech/api/checkout/questions"))
    const oversized = await GET(new Request(`https://ticketpulse.tech/api/checkout/questions?eventSlug=${"a".repeat(161)}`))

    expect(missing.status).toBe(400)
    expect(oversized.status).toBe(400)
    expect(state.selectCount).toBe(0)
  })

  it("does not reveal questions for unpublished events", async () => {
    state.event = null
    const { GET } = await import("@/app/api/checkout/questions/route")
    const response = await GET(new Request("https://ticketpulse.tech/api/checkout/questions?eventSlug=draft-event"))

    expect(response.status).toBe(404)
    expect(state.selectCount).toBe(1)
  })

  it("rate limits repeated requests", async () => {
    state.allowed = false
    state.retryAfterMs = 12_000
    const { GET } = await import("@/app/api/checkout/questions/route")
    const response = await GET(new Request("https://ticketpulse.tech/api/checkout/questions?eventSlug=summer-fest"))

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("12")
    expect(state.selectCount).toBe(0)
  })
})
