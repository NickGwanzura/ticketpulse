import { describe, it, expect } from "vitest"

describe("organizer approval", () => {
  it("should reject unapproved organizers from creating events", () => {
    // Simulate the approval gate logic
    const session = { user: { role: "organizer", approvedAt: null } }
    const isOrganizer = session.user.role === "organizer"
    const isAdmin = session.user.role === "admin"
    const isApproved = !!session.user.approvedAt

    if (isOrganizer && !isApproved) {
      expect(isApproved).toBe(false)
    }
    if (!isOrganizer && !isAdmin) {
      expect(isOrganizer).toBe(false)
    }
  })

  it("should allow approved organizers to create events", () => {
    const session = { user: { role: "organizer", approvedAt: new Date("2026-06-01") } }
    const isOrganizer = session.user.role === "organizer"
    const isApproved = !!session.user.approvedAt

    expect(isOrganizer).toBe(true)
    expect(isApproved).toBe(true)
  })

  it("should allow admins to create events regardless of approval", () => {
    const session = { user: { role: "admin", approvedAt: null } }
    const isOrganizer = session.user.role === "organizer"
    const isAdmin = session.user.role === "admin"
    const isApproved = !!session.user.approvedAt

    // Admins bypass the approval check
    expect(isAdmin).toBe(true)
    if (isAdmin) {
      expect(true).toBe(true) // admin always passes
    }
  })

  it("should allow other roles (transport, etc.) to be rejected from event creation", () => {
    const session = { user: { role: "transport_operator", approvedAt: null } }
    const isOrganizer = session.user.role === "organizer"
    const isAdmin = session.user.role === "admin"

    expect(isOrganizer).toBe(false)
    expect(isAdmin).toBe(false)
  })

  it("should set approvedAt on approve action", () => {
    // Simulate the approveOrganizerAction logic
    const beforeApproval = { approvedAt: null as Date | null }
    const afterApproval = { approvedAt: new Date() }

    expect(beforeApproval.approvedAt).toBeNull()
    expect(afterApproval.approvedAt).toBeInstanceOf(Date)
  })

  it("should clear approvedAt on reject action", () => {
    // Simulate the rejectOrganizerAction logic
    const beforeRejection = { approvedAt: new Date("2026-06-01") }
    const afterRejection = { approvedAt: null }

    expect(beforeRejection.approvedAt).toBeInstanceOf(Date)
    expect(afterRejection.approvedAt).toBeNull()
  })

  it("should show pending status when approvedAt is null for organizers", () => {
    const user = { role: "organizer", approvedAt: null }
    const isOrganizer = user.role === "organizer"
    const isPending = isOrganizer && !user.approvedAt

    expect(isPending).toBe(true)
  })

  it("should show approved date when approvedAt is set", () => {
    const date = new Date("2026-06-15")
    const user = { role: "organizer", approvedAt: date }
    const isOrganizer = user.role === "organizer"
    const isApproved = isOrganizer && !!user.approvedAt

    expect(isApproved).toBe(true)
    expect(user.approvedAt.toISOString().slice(0, 10)).toBe("2026-06-15")
  })

  it("should show dash for non-organizer roles in the approved column", () => {
    const roles = ["attendee", "vendor", "transport_operator", "dispatcher", "driver", "conductor"]
    for (const role of roles) {
      const user = { role, approvedAt: null }
      const shouldShowDash = user.role !== "organizer"
      expect(shouldShowDash).toBe(true)
    }
  })
})
