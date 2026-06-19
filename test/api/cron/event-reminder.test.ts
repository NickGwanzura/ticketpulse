import { describe, it, expect, vi, beforeEach } from "vitest"

// Shared mutable sequence for DB mock calls
const dbSequence: Array<unknown[]> = []
let dbCallIndex = 0

vi.mock("@/db", () => ({
  db: {
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(null),
        catch: () => {}, // only needed if the update is awaited inside catch
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => {
          const val = dbSequence[dbCallIndex] ?? []
          dbCallIndex++
          // The promise returned by .where() resolves to val directly.
          // A .limit() chain also resolves to val.
          const result = Promise.resolve(val)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          ;(result as unknown as Record<string, unknown>).limit = () => val
          return result
        },
      }),
    }),
  },
}))

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ and: args }),
  eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
  gte: (a: unknown, b: unknown) => ({ gte: [a, b] }),
  lt: (a: unknown, b: unknown) => ({ lt: [a, b] }),
  inArray: (a: unknown, b: unknown[]) => ({ inArray: [a, b] }),
  isNotNull: (a: unknown) => ({ isNotNull: a }),
  desc: (a: unknown) => ({ desc: a }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ sql: strings.join("?"), params: values }),
  relations: () => ({}),
}))

vi.mock("@/lib/cron-auth", () => ({
  verifyCronSecret: () => null,
}))

vi.mock("@/lib/whatsapp", () => ({
  sendText: vi.fn().mockResolvedValue({ messageId: "mock-wa-id", timestamp: Date.now() }),
  formatChatId: (phone: string) => `${phone.replace(/\D/g, "")}@c.us`,
}))

vi.mock("@/lib/email", () => ({
  sendEventReminderEmail: vi.fn().mockResolvedValue({ id: "mock-email-id" }),
}))

vi.mock("@/lib/whatsapp-templates", () => ({
  ticketConfirmationMessage: (...args: unknown[]) => `Mock reminder: ${args[0]} - ${args[3]}`,
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

function makeTomorrow(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000)
}

describe("event-reminder cron", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbSequence.length = 0
    dbCallIndex = 0
    process.env.NEXT_PUBLIC_APP_URL = "https://ticketpulse.tech"
  })

  it("should return checked=0 when no upcoming events", async () => {
    dbSequence.push([]) // no upcoming events

    const { POST } = await import("@/app/api/cron/event-reminder/route")
    const req = new Request("https://ticketpulse.tech/api/cron/event-reminder", { method: "POST" })
    const res = await POST(req)
    const data = await res.json()

    expect(data.checked).toBe(0)
    expect(data.sent).toBe(0)
    expect(data.errors).toBe(0)
  })

  it("should detect upcoming events and send reminders", async () => {
    const tomorrow = makeTomorrow()

    dbSequence.push([
      { id: "evt-001", title: "Test Event", slug: "test-event", startsAt: tomorrow, venue: "Venue 1", organizerId: "org-001" },
    ])
    dbSequence.push([
      { id: "ord-001", guestName: "John", guestEmail: "john@test.com", guestPhone: "+263771234567" },
    ])

    const { POST } = await import("@/app/api/cron/event-reminder/route")
    const req = new Request("https://ticketpulse.tech/api/cron/event-reminder", { method: "POST" })
    const res = await POST(req)
    const data = await res.json()

    expect(data.checked).toBe(1)
    expect(data.sent).toBeGreaterThan(0)
  })

  it("should send WhatsApp when buyer has phone but no email", async () => {
    dbSequence.push([
      { id: "evt-002", title: "Phone Only", slug: "phone-only", startsAt: makeTomorrow(), venue: null, organizerId: "org-001" },
    ])
    dbSequence.push([
      { id: "ord-002", guestName: "Jane", guestEmail: null, guestPhone: "+263778889999" },
    ])

    const { POST } = await import("@/app/api/cron/event-reminder/route")
    const req = new Request("https://ticketpulse.tech/api/cron/event-reminder", { method: "POST" })
    await POST(req)

    const { sendText } = await import("@/lib/whatsapp")
    const { sendEventReminderEmail } = await import("@/lib/email")
    expect(sendText).toHaveBeenCalledTimes(1)
    expect(sendEventReminderEmail).not.toHaveBeenCalled()
  })

  it("should send email when buyer has email but no phone", async () => {
    dbSequence.push([
      { id: "evt-003", title: "Email Only", slug: "email-only", startsAt: makeTomorrow(), venue: null, organizerId: "org-001" },
    ])
    dbSequence.push([
      { id: "ord-003", guestName: "Bob", guestEmail: "bob@test.com", guestPhone: null },
    ])

    const { POST } = await import("@/app/api/cron/event-reminder/route")
    const req = new Request("https://ticketpulse.tech/api/cron/event-reminder", { method: "POST" })
    await POST(req)

    const { sendText } = await import("@/lib/whatsapp")
    const { sendEventReminderEmail } = await import("@/lib/email")
    expect(sendEventReminderEmail).toHaveBeenCalledTimes(1)
    expect(sendText).not.toHaveBeenCalled()
  })

  it("should send both WhatsApp and email when buyer has both", async () => {
    dbSequence.push([
      { id: "evt-004", title: "Full Contact", slug: "full-contact", startsAt: makeTomorrow(), venue: "Main Hall", organizerId: "org-001" },
    ])
    dbSequence.push([
      { id: "ord-004", guestName: "Alice", guestEmail: "alice@test.com", guestPhone: "+263770000000" },
    ])

    const { POST } = await import("@/app/api/cron/event-reminder/route")
    const req = new Request("https://ticketpulse.tech/api/cron/event-reminder", { method: "POST" })
    await POST(req)

    const { sendText } = await import("@/lib/whatsapp")
    const { sendEventReminderEmail } = await import("@/lib/email")
    expect(sendText).toHaveBeenCalledTimes(1)
    expect(sendEventReminderEmail).toHaveBeenCalledTimes(1)
  })

  it("should skip buyers with neither phone nor email", async () => {
    dbSequence.push([
      { id: "evt-005", title: "No Contact", slug: "no-contact", startsAt: makeTomorrow(), venue: null, organizerId: "org-001" },
    ])
    dbSequence.push([
      { id: "ord-005", guestName: "Ghost", guestEmail: null, guestPhone: null },
    ])

    const { POST } = await import("@/app/api/cron/event-reminder/route")
    const req = new Request("https://ticketpulse.tech/api/cron/event-reminder", { method: "POST" })
    const res = await POST(req)
    const data = await res.json()

    expect(data.sent).toBe(0)
    const { sendText } = await import("@/lib/whatsapp")
    const { sendEventReminderEmail } = await import("@/lib/email")
    expect(sendText).not.toHaveBeenCalled()
    expect(sendEventReminderEmail).not.toHaveBeenCalled()
  })

  it("should handle multiple events with multiple orders", async () => {
    const tomorrow = makeTomorrow()

    dbSequence.push([
      { id: "evt-006", title: "First Event", slug: "first", startsAt: tomorrow, venue: "Hall A", organizerId: "org-001" },
      { id: "evt-007", title: "Second Event", slug: "second", startsAt: tomorrow, venue: "Hall B", organizerId: "org-001" },
    ])
    dbSequence.push([
      { id: "ord-006", guestName: "User1", guestEmail: "u1@test.com", guestPhone: "+263771111111" },
      { id: "ord-007", guestName: "User2", guestEmail: "u2@test.com", guestPhone: "+263772222222" },
    ])
    dbSequence.push([
      { id: "ord-008", guestName: "User3", guestEmail: "u3@test.com", guestPhone: "+263773333333" },
    ])

    const { POST } = await import("@/app/api/cron/event-reminder/route")
    const req = new Request("https://ticketpulse.tech/api/cron/event-reminder", { method: "POST" })
    const res = await POST(req)
    const data = await res.json()

    expect(data.checked).toBe(2)
    expect(data.sent).toBeGreaterThan(0)
  })

  it("should handle WhatsApp send failures gracefully", async () => {
    const { sendText } = await import("@/lib/whatsapp")
    ;(sendText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("OpenWA connection failed"))

    dbSequence.push([
      { id: "evt-008", title: "Fail Event", slug: "fail", startsAt: makeTomorrow(), venue: null, organizerId: "org-001" },
    ])
    dbSequence.push([
      { id: "ord-009", guestName: "FailUser", guestEmail: "fail@test.com", guestPhone: "+263774444444" },
    ])

    const { POST } = await import("@/app/api/cron/event-reminder/route")
    const req = new Request("https://ticketpulse.tech/api/cron/event-reminder", { method: "POST" })
    const res = await POST(req)
    const data = await res.json()

    expect(data.results[0].errors).toBeGreaterThanOrEqual(1)
    const { sendEventReminderEmail } = await import("@/lib/email")
    expect(sendEventReminderEmail).toHaveBeenCalled()
  })
})
