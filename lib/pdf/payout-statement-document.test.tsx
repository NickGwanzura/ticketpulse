// @vitest-environment node
import { describe, expect, it } from "vitest"

import { generatePayoutStatementPdfBuffer, type PayoutStatementData } from "@/lib/pdf/payout-statement-document"

const baseData: PayoutStatementData = {
  organizerName: "Marlone Mariga",
  organizerEmail: "marlone@example.com",
  generatedAt: new Date("2026-09-29T10:00:00Z"),
  grossRevenue: 4160,
  platformFee: 208,
  platformFeePercent: 5,
  netRevenue: 3952,
  paidOut: 1740,
  pendingPayouts: 0,
  outstandingClawbacks: 0,
  availableBalance: 2212,
  confirmedTicketCount: 100,
  confirmedOrderCount: 50,
  payouts: [{
    id: "payout-1",
    amount: 200,
    currency: "USD",
    status: "paid",
    method: "ecocash",
    recipientName: "Marlone Mariga",
    reference: "ECO-12345",
    eventTitle: "Sunset Bottomless Mimosas",
    createdAt: new Date("2026-09-14T10:00:00Z"),
    processedAt: new Date("2026-09-14T10:05:00Z"),
  }],
}

describe("payout statement PDF", () => {
  it.each([
    { name: "organiser-wide", eventTitle: undefined },
    { name: "event-specific", eventTitle: "Sunset Bottomless Mimosas" },
  ])("renders a valid $name statement", async ({ eventTitle }) => {
    const pdf = await generatePayoutStatementPdfBuffer({ ...baseData, eventTitle })

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-")
    expect(pdf.length).toBeGreaterThan(1000)
  })
})
