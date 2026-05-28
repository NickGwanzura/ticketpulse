import { describe, it, expect } from "vitest"
import { slugify } from "@/lib/utils"

describe("slugify (re-verified in dedicated test)", () => {
  it("generates consistent slugs", () => {
    expect(slugify("Summer Music Festival 2026")).toBe("summer-music-festival-2026")
  })

  it("handles multiple spaces", () => {
    expect(slugify("Harare   Half   Marathon")).toBe("harare-half-marathon")
  })

  it("removes apostrophes", () => {
    expect(slugify("Children's Day Out")).toBe("childrens-day-out")
  })

  it("handles ampersands — stripped to double space then collapsed", () => {
    // "&" is removed, leaving two spaces which collapse to one hyphen
    expect(slugify("Rock & Roll Night")).toBe("rock-roll-night")
  })
})
