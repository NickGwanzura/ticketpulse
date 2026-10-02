import { createRequire } from "node:module"
import { PgDialect } from "drizzle-orm/pg-core"
import type { SQL } from "drizzle-orm"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock("@/db", () => ({ db: { execute: mocks.execute } }))
import { getTicketTierSales } from "@/lib/ticket-tier-sales"

// The app's Node 20 type declarations predate SQLite, which is available in
// the Node 22+ runtime used by the Dockerfile. Keep this test-only API local.
type FixtureDatabase = {
  exec(query: string): void
  prepare(query: string): { all(...params: string[]): Record<string, unknown>[] }
  close(): void
}
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => FixtureDatabase
}
let database: FixtureDatabase

beforeEach(() => {
  database = new DatabaseSync(":memory:")
  database.exec(`
    CREATE TABLE orders (id TEXT, event_id TEXT, payment_method TEXT, total_amount REAL, status TEXT, currency TEXT DEFAULT 'USD');
    CREATE TABLE tickets (event_id TEXT, tier_id TEXT, order_id TEXT, is_staff_ticket BOOLEAN, status TEXT);
    CREATE TABLE order_items (order_id TEXT, tier_id TEXT, type TEXT, quantity INTEGER, total REAL);
    CREATE TABLE ticket_tiers (id TEXT, event_id TEXT, name TEXT, price REAL, currency TEXT, total_quantity INTEGER, sold_quantity INTEGER, created_at INTEGER);
    INSERT INTO ticket_tiers VALUES
      ('vip', 'event-a', 'VIP', 100, 'USD', 20, 10, 1),
      ('ga', 'event-a', 'General Admission', 25, 'USD', 50, 1, 2),
      ('empty', 'event-a', 'Early Bird', 15, 'ZWG', 10, 0, 3),
      ('private', 'event-b', 'VIP', 500, 'USD', 100, 5, 4);
  `)
  mocks.execute.mockReset()
  mocks.execute.mockImplementation(async (query: SQL) => {
    const compiled = new PgDialect().sqlToQuery(query)
    // Run the production CTEs against fixtures; only PostgreSQL's casts and
    // scalar function names differ from SQLite. REAL columns preserve money division.
    const portable = compiled.sql.replace(/::int/g, "")
      .replace(/\bLEAST\(/g, "min(").replace(/\bGREATEST\(/g, "max(")
      .replace(/\$\d+/g, "?")
    return { rows: database.prepare(portable).all(...compiled.params as string[]) }
  })
})
afterEach(() => database.close())

describe("issued ticket sales by tier", () => {
  it("keeps zero-sale tiers and excludes events outside the authorized IDs", async () => {
    const result = await getTicketTierSales(["event-a"])
    expect([...result.keys()]).toEqual(["event-a"])
    expect(result.get("event-a")?.map(t => t.name)).toEqual(["VIP", "General Admission", "Early Bird"])
    expect(result.get("event-a")?.[2]).toMatchObject({ sold: 0, revenue: 0, remaining: 10, currency: "ZWG" })
  })

  it("separates confirmed sales, comps and holds while excluding staff, pending and refunded tickets", async () => {
    database.exec(`
      INSERT INTO orders(id, event_id, payment_method, total_amount, status) VALUES
        ('paid', 'event-a', 'ecocash', 100, 'paid'),
        ('comp', 'event-a', 'complimentary', 0, 'completed'),
        ('pending', 'event-a', 'ecocash', 50, 'pending'),
        ('refund', 'event-a', 'ecocash', 50, 'refunded');
      INSERT INTO order_items VALUES ('paid', 'vip', 'ticket', 2, 100);
      INSERT INTO tickets VALUES
        ('event-a', 'vip', 'paid', false, 'sold'),
        ('event-a', 'vip', 'paid', false, 'used'),
        ('event-a', 'vip', 'paid', true, 'sold'),
        ('event-a', 'vip', 'paid', false, 'refunded'),
        ('event-a', 'vip', 'comp', false, 'sold'),
        ('event-a', 'vip', 'pending', false, 'sold'),
        ('event-a', 'vip', 'refund', false, 'sold');
    `)
    const vip = (await getTicketTierSales(["event-a"])).get("event-a")?.[0]
    expect(vip).toMatchObject({ sold: 2, complimentary: 1, reserved: 7, remaining: 10, revenue: 100 })
  })

  it("uses historical line prices and allocates a mixed-order discount across ticket tiers and merchandise", async () => {
    database.exec(`
      INSERT INTO orders(id, event_id, payment_method, total_amount, status) VALUES ('discounted', 'event-a', 'ecocash', 60, 'paid');
      INSERT INTO order_items VALUES
        ('discounted', 'vip', 'ticket', 2, 80),
        ('discounted', 'ga', 'ticket', 1, 20),
        ('discounted', NULL, 'merch', 1, 20);
      INSERT INTO tickets VALUES
        ('event-a', 'vip', 'discounted', false, 'sold'),
        ('event-a', 'vip', 'discounted', false, 'sold'),
        ('event-a', 'ga', 'discounted', false, 'used');
    `)
    const tiers = (await getTicketTierSales(["event-a"])).get("event-a")!
    expect(tiers[0]).toMatchObject({ sold: 2, price: 100, revenue: 40 })
    expect(tiers[1]).toMatchObject({ sold: 1, revenue: 10 })
  })

  it("does not multiply sales from repeated line items and counts only delivered direct-sale tickets", async () => {
    database.exec(`
      INSERT INTO orders(id, event_id, payment_method, total_amount, status) VALUES
        ('repeat', 'event-a', 'ecocash', 60, 'completed'),
        ('partial', 'event-a', 'organizer_direct', 90, 'completed');
      INSERT INTO order_items VALUES
        ('repeat', 'vip', 'ticket', 1, 20),
        ('repeat', 'vip', 'ticket', 1, 40),
        ('partial', 'vip', 'ticket', 3, 90);
      INSERT INTO tickets VALUES
        ('event-a', 'vip', 'repeat', false, 'sold'),
        ('event-a', 'vip', 'repeat', false, 'used'),
        ('event-a', 'vip', 'partial', false, 'sold');
    `)
    expect((await getTicketTierSales(["event-a"])).get("event-a")?.[0]).toMatchObject({ sold: 3, revenue: 90 })
  })

  it("clamps available stock when actual issued tickets exceed the inventory counter", async () => {
    database.exec(`
      UPDATE ticket_tiers SET total_quantity = 1, sold_quantity = 0 WHERE id = 'vip';
      INSERT INTO orders(id, event_id, payment_method, total_amount, status) VALUES ('paid', 'event-a', NULL, 0, 'paid');
      INSERT INTO tickets VALUES
        ('event-a', 'vip', 'paid', false, 'sold'),
        ('event-a', 'vip', 'paid', false, 'used');
    `)
    expect((await getTicketTierSales(["event-a"])).get("event-a")?.[0]).toMatchObject({ sold: 2, reserved: 0, remaining: 0 })
  })

  it("does not query the database when no events are authorized", async () => {
    expect((await getTicketTierSales([])).size).toBe(0)
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it("keeps revenue currencies separate when a tier currency changes after a sale", async () => {
    database.exec(`
      INSERT INTO orders VALUES
        ('usd', 'event-a', 'ecocash', 50, 'paid', 'USD'),
        ('zwg', 'event-a', 'ecocash', 250, 'paid', 'ZWG');
      INSERT INTO order_items VALUES
        ('usd', 'vip', 'ticket', 1, 50),
        ('zwg', 'vip', 'ticket', 1, 250);
      INSERT INTO tickets VALUES
        ('event-a', 'vip', 'usd', false, 'sold'),
        ('event-a', 'vip', 'zwg', false, 'sold');
    `)
    const tiers = (await getTicketTierSales(["event-a"])).get("event-a")!
    expect(tiers).toHaveLength(3)
    expect(tiers[0]).toMatchObject({ sold: 2, revenue: 50, revenueByCurrency: [
      { currency: "USD", amount: 50 }, { currency: "ZWG", amount: 250 },
    ] })
  })
})
