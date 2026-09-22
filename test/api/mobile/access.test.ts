import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ auth: vi.fn(), select: vi.fn(), bearer: vi.fn() }))
vi.mock("@/auth", () => ({ auth: mocks.auth }))
vi.mock("@/db", () => ({ db: { select: mocks.select } }))
vi.mock("@/lib/mobile-auth", () => ({ authenticateRequest: mocks.bearer }))
import { requireEventAccess, requireEventAccessForUser } from "@/lib/event-access"
import { authenticateOrganizer, organizerEventScope } from "@/lib/mobile-organizer"
import { PgDialect } from "drizzle-orm/pg-core"

function rows(...values: unknown[][]) {
  for (const value of values) mocks.select.mockReturnValueOnce({ from: () => ({ where: () => ({ limit: async () => value }) }) })
}
beforeEach(() => { vi.resetAllMocks() })
it("keeps web session authorization for existing callers", async () => {
  mocks.auth.mockResolvedValue(null)
  expect((await requireEventAccess("event")).allowed).toBe(false)
  expect(mocks.select).not.toHaveBeenCalled()
})
it("authorizes event owners without a web cookie", async () => {
  rows([{ frozenAt: null }], [{ id: "event", organizerId: "owner" }])
  expect(await requireEventAccessForUser("event", { id: "owner", role: "organizer" })).toMatchObject({ allowed: true, role: "owner" })
  expect(mocks.auth).not.toHaveBeenCalled()
})
it("checks invited membership for other organizers", async () => {
  rows([{ frozenAt: null }], [{ id: "event", organizerId: "owner" }], [{ id: "invitation" }])
  expect(await requireEventAccessForUser("event", { id: "invited", role: "organizer" })).toMatchObject({ allowed: true, role: "editor" })
})
it("denies unrelated organizers", async () => {
  rows([{ frozenAt: null }], [{ id: "event", organizerId: "owner" }], [])
  expect((await requireEventAccessForUser("event", { id: "outsider", role: "organizer" })).allowed).toBe(false)
})
it("rejects a revoked role even with an existing organizer access token", async () => {
  mocks.bearer.mockResolvedValue({ ok: true, userId: "user", role: "organizer" })
  rows([{ role: "attendee" }])
  expect(await authenticateOrganizer(new Request("https://example.com"))).toMatchObject({ ok: false, status: 403 })
})
it("scopes organizer queries by owner or invited membership using parameters", () => {
  const scope = organizerEventScope("user-1", "organizer")!
  const query = new PgDialect().sqlToQuery(scope)
  expect(query.params).toEqual(["user-1", "user-1"])
  expect(query.sql).toContain('"organizer_id"')
  expect(query.sql).toContain('EXISTS')
  expect(organizerEventScope("admin", "admin")).toBeUndefined()
})
