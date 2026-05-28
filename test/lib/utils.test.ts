import { describe, it, expect } from "vitest"
import {
  cn,
  formatCurrency,
  formatDate,
  formatDateShort,
  slugify,
  availabilityLabel,
  vehicleLabel,
  vendorCategoryLabel,
} from "@/lib/utils"

// ── cn ──────────────────────────────────────────────────────────────────────

describe("cn", () => {
  it("merges Tailwind classes, later overrides earlier", () => {
    expect(cn("px-4 py-2", "px-6")).toBe("py-2 px-6")
  })

  it("filters falsy values", () => {
    expect(cn("base", false && "hidden", null, undefined, 0, "keep")).toBe("base keep")
  })

  it("returns empty string for no args", () => {
    expect(cn()).toBe("")
  })
})

// ── formatCurrency ──────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  it("formats USD with en-US locale", () => {
    // minimumFractionDigits is 0, so 12.5 stays as-is (no trailing zero)
    const result = formatCurrency(12.5, "USD")
    expect(result).toContain("$")
    expect(result).toContain("12")
  })

  it("formats ZWL with en-ZW locale", () => {
    const result = formatCurrency(100, "ZWL")
    expect(result).toContain("100")
  })

  it("formats ZAR with en-ZA locale", () => {
    const result = formatCurrency(50, "ZAR")
    expect(result).toContain("R")
  })

  it("defaults to USD when currency is unknown", () => {
    const result = formatCurrency(10, "EUR")
    expect(result).toContain("€")
  })

  it("handles zero", () => {
    expect(formatCurrency(0, "USD")).toContain("0")
  })

  it("handles large numbers", () => {
    expect(formatCurrency(1_000_000, "USD")).toContain("1")
  })
})

// ── formatDate / formatDateShort ────────────────────────────────────────────

describe("formatDate", () => {
  it("formats a Date object", () => {
    const d = new Date("2026-06-15T14:00:00Z")
    const result = formatDate(d)
    expect(result).toContain("2026")
    expect(result).toContain("Jun")
  })

  it("formats an ISO string", () => {
    const result = formatDate("2026-12-25T10:00:00Z")
    expect(result).toContain("2026")
    expect(result).toContain("Dec")
  })

  it("accepts custom options that override defaults", () => {
    // Override just timeStyle (can't mix dateStyle/timeStyle with
    // individual components — that's a spec violation Node enforces)
    const result = formatDate("2026-06-01T14:30:00Z", {
      timeStyle: "medium",
      timeZone: "UTC",
    })
    expect(result).toContain("14:30:00")
  })
})

describe("formatDateShort", () => {
  it("returns short date string", () => {
    const result = formatDateShort("2026-06-15")
    expect(result).toContain("Jun")
    expect(result).toContain("2026")
  })
})

// ── slugify ─────────────────────────────────────────────────────────────────

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world")
  })

  it("removes special characters", () => {
    expect(slugify("What's Up?")).toBe("whats-up")
  })

  it("collapses multiple hyphens", () => {
    expect(slugify("foo___bar")).toBe("foo-bar")
  })

  it("trims leading/trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello")
  })

  it("handles empty string", () => {
    expect(slugify("")).toBe("")
  })
})

// ── availabilityLabel ───────────────────────────────────────────────────────

describe("availabilityLabel", () => {
  it("returns 'Sold out' when remaining is 0", () => {
    const { label, color } = availabilityLabel(100, 100)
    expect(label).toBe("Sold out")
    expect(color).toContain("red")
  })

  it("returns countdown when 10 or fewer remaining", () => {
    const { label, color } = availabilityLabel(95, 100)
    expect(label).toBe("5 left")
    expect(color).toContain("amber")
  })

  it("returns 'Available' when plenty of tickets left", () => {
    const { label, color } = availabilityLabel(10, 100)
    expect(label).toBe("Available")
    expect(color).toContain("teal")
  })
})

// ── vehicleLabel ────────────────────────────────────────────────────────────

describe("vehicleLabel", () => {
  it("maps known types", () => {
    expect(vehicleLabel("kombi")).toBe("Kombi")
    expect(vehicleLabel("bus")).toBe("Bus")
    expect(vehicleLabel("sedan")).toBe("Sedan")
    expect(vehicleLabel("suv")).toBe("SUV")
  })

  it("falls back to input for unknown types", () => {
    expect(vehicleLabel("helicopter")).toBe("helicopter")
  })
})

// ── vendorCategoryLabel ─────────────────────────────────────────────────────

describe("vendorCategoryLabel", () => {
  it("maps known categories", () => {
    expect(vendorCategoryLabel("catering")).toBe("Catering")
    expect(vendorCategoryLabel("food_truck")).toBe("Food Truck")
    expect(vendorCategoryLabel("sound")).toBe("Sound and AV")
  })

  it("falls back to raw string for unknown", () => {
    expect(vendorCategoryLabel("magician")).toBe("magician")
  })
})
