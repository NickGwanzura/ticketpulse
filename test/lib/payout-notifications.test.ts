import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ sendEmail: vi.fn(), sendText: vi.fn() }))
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail }))
vi.mock("@/lib/whatsapp", () => ({
  formatChatId: (phone: string) => {
    let digits = phone.replace(/\D/g, "")
    if (digits.startsWith("0")) digits = `263${digits.slice(1)}`
    else if (digits.length === 9 && digits.startsWith("7")) digits = `263${digits}`
    return `${digits}@c.us`
  },
  sendText: mocks.sendText,
}))
vi.mock("@/lib/logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { sendPayoutNotice } from "@/lib/payout-notifications"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.sendEmail.mockResolvedValue({ id: "email-1" })
  mocks.sendText.mockResolvedValue({ messageId: "message-1", timestamp: 1 })
})

describe("payout notifications", () => {
  it("sends both email and WhatsApp for a payout request", async () => {
    await sendPayoutNotice({
      payoutId: "payout-1",
      organizerName: "Paida",
      email: "paida@example.com",
      phone: "+263 771 234 567",
      amount: "460.00",
      method: "ecocash",
      status: "requested",
      eventTitle: "Sunset Mimosa",
    })

    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "paida@example.com", subject: expect.stringContaining("Payout request received") }))
    expect(mocks.sendText).toHaveBeenCalledWith("263771234567@c.us", expect.stringContaining("Event: Sunset Mimosa"))
  })

  it("includes the provider proof in paid notices", async () => {
    await sendPayoutNotice({
      payoutId: "payout-2",
      email: "organizer@example.com",
      phone: "0771234567",
      amount: 55,
      method: "bank_usd",
      status: "paid",
      eventTitle: "KAOS",
      proofReference: "REF-55",
    })

    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining("Reference: REF-55") }))
    expect(mocks.sendText).toHaveBeenCalledWith("263771234567@c.us", expect.stringContaining("Reference: REF-55"))
  })

  it("escapes organiser-controlled HTML fields", async () => {
    await sendPayoutNotice({
      payoutId: "payout-3",
      organizerName: "<img src=x>",
      email: "organizer@example.com",
      phone: "0771234567",
      amount: 10,
      method: "bank_usd",
      status: "approved",
      eventTitle: "<script>alert(1)</script>",
    })

    const email = mocks.sendEmail.mock.calls[0]?.[0]
    expect(email.html).not.toContain("<script>")
    expect(email.html).toContain("&lt;script&gt;")
  })
})
