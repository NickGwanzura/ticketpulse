import { act } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToStaticMarkup, renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import AuditTrail from "@/components/orders/AuditTrail"
import RecoveryPanel from "@/components/orders/RecoveryPanel"

describe("order admin hydration", () => {
  it("hydrates RecoveryPanel before calculating the pending age from the browser clock", async () => {
    const renderedAtMs = Date.UTC(2026, 8, 30, 12)
    const order = {
      id: "order-1",
      status: "pending",
      paymentMethod: "ecocash",
      metadata: {},
      createdAt: new Date(renderedAtMs - 3 * 60 * 60 * 1000),
      paidAt: null,
      verificationSentAt: null,
      verifiedAt: null,
      completedAt: null,
    }
    const element = <RecoveryPanel order={order} />
    const container = document.createElement("div")
    container.innerHTML = renderToString(element)
    expect(container.textContent).toContain("Payment in progress")
    document.body.appendChild(container)

    const recoverableErrors: unknown[] = []
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(renderedAtMs + 10 * 60 * 60 * 1000)
    let root: ReturnType<typeof hydrateRoot> | undefined

    try {
      await act(async () => {
        root = hydrateRoot(container, element, {
          onRecoverableError: (error) => recoverableErrors.push(error),
        })
      })

      expect(recoverableErrors).toEqual([])
      expect(container.textContent).toContain("Payment pending for 13 hours")
    } finally {
      if (root) {
        await act(async () => root?.unmount())
      }
      nowSpy.mockRestore()
      container.remove()
    }
  })

  it("renders a valid ordered list and a timezone-stable audit timestamp", () => {
    const timestamp = new Date("2026-09-30T12:00:00.000Z")
    const markup = renderToStaticMarkup(
      <AuditTrail
        order={{
          status: "pending",
          createdAt: timestamp,
          paidAt: null,
          verifiedAt: null,
          completedAt: null,
          verificationSentAt: null,
          metadata: {},
        }}
      />,
    )
    const template = document.createElement("template")
    template.innerHTML = markup
    const list = template.content.querySelector("ol")
    const expectedTime = new Intl.DateTimeFormat("en-ZW", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Harare",
    }).format(timestamp)

    expect(list).not.toBeNull()
    expect([...list!.children].every((child) => child.tagName === "LI")).toBe(true)
    expect(markup).toContain(expectedTime)
  })
})
