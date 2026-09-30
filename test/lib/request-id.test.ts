import { describe, expect, it } from "vitest"
import { requestIdFor, withRequestId } from "@/lib/request-id"

describe("request IDs", () => {
  it("reuses a canonical UUID from the request", () => {
    const request = new Request("https://ticketpulse.test", {
      headers: { "x-request-id": "550e8400-e29b-41d4-a716-446655440000" },
    })

    expect(requestIdFor(request)).toBe("550e8400-e29b-41d4-a716-446655440000")
  })

  it("replaces arbitrary client values with a safe generated UUID", () => {
    const request = new Request("https://ticketpulse.test", {
      headers: { "x-request-id": "operator secret; forged=1" },
    })
    const requestId = requestIdFor(request)

    expect(requestId).not.toContain("operator")
    expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it("adds the ID to the response header for client diagnostics", () => {
    const response = withRequestId(new Response(null), "550e8400-e29b-41d4-a716-446655440000")

    expect(response.headers.get("x-request-id")).toBe("550e8400-e29b-41d4-a716-446655440000")
  })
})
