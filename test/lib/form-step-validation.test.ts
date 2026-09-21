import { describe, expect, it } from "vitest"

import { reportStepValidity } from "@/lib/form-step-validation"

describe("form step validation", () => {
  it("ignores required controls in future CSS-hidden steps", () => {
    document.body.innerHTML = `
      <form>
        <section data-step="current"><input name="title" required value="Concert"></section>
        <section style="display:none"><input name="venue" required></section>
      </form>
    `

    const form = document.querySelector("form")!
    const current = document.querySelector('[data-step="current"]')!

    expect(form.reportValidity()).toBe(false)
    expect(reportStepValidity(current)).toBe(true)
  })

  it("reports an invalid control in the active step", () => {
    document.body.innerHTML = `
      <form>
        <section data-step="current"><input name="title" required></section>
      </form>
    `

    expect(reportStepValidity(document.querySelector('[data-step="current"]'))).toBe(false)
  })
})
