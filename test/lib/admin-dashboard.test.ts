import { describe, expect, it, vi, beforeEach } from "vitest"
import { PgDialect } from "drizzle-orm/pg-core"

const insertValues = vi.fn()
vi.mock("@/db", () => ({
  db: { insert: () => ({ values: insertValues }) },
}))

import {
  ORDER_ISSUES,
  ORDER_ISSUE_LABEL,
  ORDER_ISSUE_WINDOW_DAYS,
  isOrderIssue,
  orderIssueCondition,
  orderIssueWindowStart,
} from "@/lib/order-issues"
import { ageLabel } from "@/lib/heartbeat"
import { recordAdminAction } from "@/lib/admin-audit"

const dialect = new PgDialect()
const render = (issue: (typeof ORDER_ISSUES)[number]) => dialect.sqlToQuery(orderIssueCondition(issue))

describe("order issue definitions", () => {
  it("recognises only the known issue keys", () => {
    for (const issue of ORDER_ISSUES) expect(isOrderIssue(issue)).toBe(true)
    expect(isOrderIssue("nope")).toBe(false)
    expect(isOrderIssue(undefined)).toBe(false)
    expect(isOrderIssue("paid_no_tickets; DROP TABLE orders")).toBe(false)
  })

  it("has a human label for every issue", () => {
    for (const issue of ORDER_ISSUES) expect(ORDER_ISSUE_LABEL[issue].length).toBeGreaterThan(3)
  })

  it("only ever matches confirmed (paid/completed) orders", () => {
    for (const issue of ORDER_ISSUES) expect(render(issue).sql).toMatch(/IN \('paid', 'completed'\)/)
  })

  it("paid_no_tickets ignores staff and cancelled/refunded tickets", () => {
    const { sql } = render("paid_no_tickets")
    expect(sql).toMatch(/NOT EXISTS/)
    expect(sql).toMatch(/is_staff_ticket = false/)
    expect(sql).toMatch(/NOT IN \('cancelled', 'refunded'\)/)
  })

  it("duplicate_ledger counts only settled ledger states, parameterised", () => {
    const { sql, params } = render("duplicate_ledger")
    expect(sql).toMatch(/HAVING COUNT\(\*\) > 1/)
    expect(params).toEqual(expect.arrayContaining(["paid", "completed", "success", "paid_success"]))
  })

  it("windows platform-wide counts to the configured number of days", () => {
    const now = new Date("2026-09-21T12:00:00Z")
    const start = orderIssueWindowStart(now)
    expect((now.getTime() - start.getTime()) / 86_400_000).toBe(ORDER_ISSUE_WINDOW_DAYS)
  })
})

describe("heartbeat age labels", () => {
  const now = new Date("2026-09-21T12:00:00Z")
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000)

  it("reads naturally at each scale", () => {
    expect(ageLabel(null, now)).toBe("never")
    expect(ageLabel(ago(20), now)).toBe("just now")
    expect(ageLabel(ago(5 * 60), now)).toBe("5 min ago")
    expect(ageLabel(ago(3 * 3600), now)).toBe("3 h ago")
    expect(ageLabel(ago(4 * 86400), now)).toBe("4 d ago")
  })
})

describe("admin audit recording", () => {
  const session = { user: { id: "admin-1", email: "boss@ticketpulse.tech" } }
  beforeEach(() => { insertValues.mockReset() })

  it("writes actor, target and before/after state", async () => {
    insertValues.mockResolvedValue(undefined)
    await recordAdminAction(session, { action: "organizer.approve", targetType: "organizer", targetId: "u1", before: { approvedAt: null }, after: { approvedAt: "now" } })
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "admin-1",
      actorEmail: "boss@ticketpulse.tech",
      action: "organizer.approve",
      targetType: "organizer",
      targetId: "u1",
      before: { approvedAt: null },
    }))
  })

  it("never lets a failed audit write break the admin action", async () => {
    insertValues.mockImplementation(() => Promise.reject(new Error('relation "admin_audit_log" does not exist')))
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(recordAdminAction(session, { action: "order.refund", targetType: "order", targetId: "o1" })).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
