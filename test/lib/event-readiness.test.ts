import { describe, expect, it } from "vitest"
import { getEventSetupChecklist, isEventReadyForReview } from "@/lib/event-readiness"

const now = new Date("2026-01-01T00:00:00Z")
const event = {
  title: "Summer Sounds",
  description: "A night of live music and local food.",
  category: "Concert",
  venue: "Harare Gardens",
  city: "Harare",
  startsAt: new Date("2026-08-01T18:00:00Z"),
  endsAt: null,
  coverImage: "https://cdn.example.com/event.jpg",
}

describe("event setup checklist", () => {
  it("requires event details, a cover image, and a ticket tier before review", () => {
    const checklist = getEventSetupChecklist("event-1", event, [
      { price: "10", totalQuantity: 100, salesStart: null, salesEnd: null },
    ], now)

    expect(isEventReadyForReview(checklist)).toBe(true)
    expect(checklist.find((item) => item.key === "sales")?.required).toBe(false)
    expect(checklist.find((item) => item.key === "sales")?.complete).toBe(false)
  })

  it("marks missing details and ticket capacity as blockers", () => {
    const checklist = getEventSetupChecklist("event-1", { ...event, description: "", coverImage: null }, [], now)

    expect(isEventReadyForReview(checklist)).toBe(false)
    expect(checklist.filter((item) => item.required && !item.complete).map((item) => item.key)).toEqual([
      "details", "image", "tickets",
    ])
  })
})
