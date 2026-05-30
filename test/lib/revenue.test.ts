// ═══════════════════════════════════════════════════════════════════════════
// Set env BEFORE mocked modules and static imports resolve.
// vi.hoisted() runs before vi.mock() and import resolution.
// ═══════════════════════════════════════════════════════════════════════════
vi.hoisted(() => {
  process.env.DATABASE_URL = "postgres://mock:mock@localhost:5432/mock"
})

import { describe, it, expect, vi } from "vitest"
import { and, or, SQL } from "drizzle-orm"

// ── Mock the Neon serverless Pool so @/db doesn't try a real connection ────
vi.mock("@neondatabase/serverless", () => {
  const MockPool = vi.fn()
  MockPool.prototype.connect = vi.fn()
  MockPool.prototype.query = vi.fn(() => Promise.resolve({ rows: [] }))
  MockPool.prototype.end = vi.fn(() => Promise.resolve())
  return {
    Pool: MockPool,
    neonConfig: { webSocketConstructor: globalThis.WebSocket },
  }
})

// ── Imports ─────────────────────────────────────────────────────────────────
import { db } from "@/db"
import { orders } from "@/db/schema"
import { confirmedOrderStatus, paymentTimeSince } from "@/lib/revenue"

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a full SELECT query with the given WHERE clause and extract the
 * generated SQL and parameters.  This lets us assert that the expected
 * columns and values appear in the compiled query.
 */
function sqlFor(condition: SQL<unknown>): { sql: string; params: unknown[] } {
  return db.select().from(orders).where(condition).toSQL()
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("revenue utility", () => {
  // ── confirmedOrderStatus ─────────────────────────────────────────────────
  describe("confirmedOrderStatus", () => {
    it("is defined and exports correctly", () => {
      expect(confirmedOrderStatus).toBeDefined()
      expect(confirmedOrderStatus).toBeInstanceOf(Object)
    })

    it("is an SQL condition (can be composed with and/or)", () => {
      expect(() => and(confirmedOrderStatus)).not.toThrow()
      expect(() => or(confirmedOrderStatus)).not.toThrow()
    })

    it("generates SQL with 'paid' and 'completed' status values", () => {
      const { sql: rawSql, params } = sqlFor(confirmedOrderStatus)
      expect(rawSql).toMatch(/status/i)
      expect(rawSql).toMatch(/\bor\b/i)
      expect(params).toContain("paid")
      expect(params).toContain("completed")
    })

    it("excludes non-revenue statuses (does not match pending/refunded/expired/awaiting)", () => {
      const { params } = sqlFor(confirmedOrderStatus)
      expect(params).not.toContain("pending")
      expect(params).not.toContain("awaiting_verification")
      expect(params).not.toContain("refunded")
      expect(params).not.toContain("cancelled")
      expect(params).not.toContain("expired")
    })
  })

  // ── paymentTimeSince ────────────────────────────────────────────────────
  describe("paymentTimeSince()", () => {
    const since = new Date("2026-06-01T00:00:00Z")
    const cond = paymentTimeSince(since)

    it("returns an SQL condition", () => {
      expect(cond).toBeDefined()
      expect(() => and(cond)).not.toThrow()
    })

    it("generates SQL with paidAt and completedAt columns", () => {
      const { sql: rawSql, params } = sqlFor(cond)
      expect(rawSql).toMatch(/paid_at/i)
      expect(rawSql).toMatch(/completed_at/i)
      expect(rawSql).toMatch(/\bor\b/i)

      // The date value should appear as a parameter (ISO string)
      expect(params.some((p) => String(p).includes("2026-06-01"))).toBe(true)
    })

    it("can be composed with and() alongside confirmedOrderStatus", () => {
      const combined = and(confirmedOrderStatus, cond)
      const { sql: rawSql, params } = sqlFor(combined)
      expect(rawSql).toMatch(/status/i)
      expect(rawSql).toMatch(/paid_at/i)
      expect(rawSql).toMatch(/completed_at/i)
      expect(params).toContain("paid")
      expect(params).toContain("completed")
    })
  })

  // ── Type safety (compile-time checks) ───────────────────────────────────
  describe("types", () => {
    it("confirmedOrderStatus is assignable to SQL<unknown>", () => {
      const _: SQL<unknown> = confirmedOrderStatus
      expect(_).toBeDefined()
    })

    it("paymentTimeSince return is assignable to SQL<unknown>", () => {
      const cond: SQL<unknown> = paymentTimeSince(new Date())
      expect(cond).toBeDefined()
    })
  })
})
