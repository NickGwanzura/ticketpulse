import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, beforeEach } from "vitest"
import {
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  applyTheme,
  lockTheme,
  nextPreference,
  parsePreference,
  resolveTheme,
  setThemePreference,
} from "@/lib/theme"

const root = path.resolve(__dirname, "../..")
const css = readFileSync(path.join(root, "app/globals.css"), "utf8")

/* ── WCAG helpers ─────────────────────────────────────────────────────── */
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Reads `--name: #hex;` from a CSS block. */
function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2].toLowerCase()
  return out
}
const themeBlock = css.slice(css.indexOf("@theme {"), css.indexOf("}", css.indexOf("@theme {")))
const darkStart = css.indexOf(':root[data-theme="dark"] {')
const darkBlock = css.slice(darkStart, css.indexOf("\n}", darkStart))
const light = { ...tokens(css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")))), ...tokens(themeBlock) }
const dark = { ...light, ...tokens(darkBlock) }

describe("theme preference logic", () => {
  it("normalizes every preference to light", () => {
    expect(parsePreference("light")).toBe("light")
    expect(parsePreference("dark")).toBe("light")
    expect(parsePreference("system")).toBe("light")
    expect(parsePreference(null)).toBe("light")
    expect(parsePreference("purple")).toBe("light")
  })

  it("always resolves to light regardless of OS or preference", () => {
    expect(resolveTheme("system", true)).toBe("light")
    expect(resolveTheme("system", false)).toBe("light")
    expect(resolveTheme("light", true)).toBe("light")
    expect(resolveTheme("dark", false)).toBe("light")
  })

  it("never advances away from light", () => {
    expect(nextPreference("light")).toBe("light")
    expect(nextPreference("dark")).toBe("light")
    expect(nextPreference("system")).toBe("light")
  })
})

describe("pre-paint theme script", () => {
  const html = document.documentElement
  const run = (stored: string | null, osDark: boolean, storageThrows = false) => {
    html.removeAttribute("data-theme")
    html.removeAttribute("data-theme-pref")
    const fakeStorage = {
      getItem: () => {
        if (storageThrows) throw new Error("blocked")
        return stored
      },
    }
    new Function("localStorage", "window", "document", THEME_INIT_SCRIPT)(fakeStorage, { matchMedia: () => ({ matches: osDark }) }, document)
  }

  it("applies the stored preference before anything else", () => {
    run("dark", false)
    expect(html.dataset.theme).toBe("light")
    expect(html.dataset.themePref).toBe("light")
    run("light", true)
    expect(html.dataset.theme).toBe("light")
  })

  it("follows the OS when nothing (or junk) is stored", () => {
    run(null, true)
    expect([html.dataset.theme, html.dataset.themePref]).toEqual(["light", "light"])
    run("nonsense", false)
    expect([html.dataset.theme, html.dataset.themePref]).toEqual(["light", "light"])
  })

  it("never throws when storage is blocked; still honours the OS", () => {
    expect(() => run(null, true, true)).not.toThrow()
    expect(html.dataset.theme).toBe("light")
  })
})

describe("applying, persisting and locking", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never
  })

  it("keeps the document light when a preference is requested", () => {
    setThemePreference("dark")
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(document.documentElement.dataset.theme).toBe("light")
    setThemePreference("system")
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(document.documentElement.dataset.themePref).toBe("light")
  })

  it("lockTheme pins a document route to light and restores the real preference", () => {
    setThemePreference("dark")
    const unlock = lockTheme("light")
    expect(document.documentElement.dataset.theme).toBe("light")
    applyTheme("dark") // e.g. an OS change while locked must not flip it
    expect(document.documentElement.dataset.theme).toBe("light")
    unlock()
    expect(document.documentElement.dataset.theme).toBe("light")
  })
})

describe("stylesheet guarantees", () => {
  it("defines dark values in exactly one place, keyed on data-theme, never print", () => {
    expect((css.match(/:root\[data-theme="dark"\] \{/g) ?? []).length).toBe(1)
    expect(css).not.toMatch(/@media \(prefers-color-scheme: dark\)\s*\{[^}]*--color-paper/)
    expect(css).toMatch(/@media not print \{\s*:root\[data-theme="dark"\] \{/)
  })

  it.each([
    ["light", light],
    ["dark", dark],
  ])("keeps text tokens >= 4.5:1 on every surface (%s)", (_name, t) => {
    for (const surface of ["color-paper", "color-paper-2", "color-paper-3"]) {
      for (const text of ["color-ink", "color-ink-2", "color-ink-3"]) {
        expect(ratio(t[text], t[surface]), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it("keeps status text >= 4.5:1 on its own surface in both themes", () => {
    for (const [name, t] of [["light", light], ["dark", dark]] as const) {
      for (const role of ["info", "sky", "success", "warning", "danger", "error", "orange", "purple", "pink", "cyan", "lime"]) {
        const text = t[`tp-${role}-text`], surface = t[`tp-${role}-surface`]
        if (!text || !surface) continue
        expect(ratio(text, surface), `${name} ${role}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it("keeps brand and primary-button colours accessible", () => {
    expect(ratio("#ffffff", light["color-brand-600"])).toBeGreaterThanOrEqual(4.5) // primary button label
    for (const surface of ["color-paper", "color-paper-2", "color-paper-3"]) {
      expect(ratio(light["color-accent"], light[surface]), `accent text on ${surface}`).toBeGreaterThanOrEqual(4.5)
    }
    expect(ratio("#ffffff", dark["color-navy"])).toBeGreaterThanOrEqual(4.5) // navy button label in dark
    expect(ratio(dark["color-navy"], dark["color-paper"])).toBeGreaterThanOrEqual(3) // and its edge against the page
    expect(ratio(light["color-chrome"], "#ffffff")).toBeGreaterThan(10)
    expect(ratio(light["color-on-whatsapp"], light["color-whatsapp"])).toBeGreaterThanOrEqual(4.5)
    expect(ratio(light["color-navy"], light["color-cta"])).toBeGreaterThanOrEqual(4.5) // navy label on the CTA orange
  })

  it("keeps solid fills that carry white text at >= 4.5:1", () => {
    for (const name of ["emerald-600", "sky-600", "orange-600", "amber-600", "rose-500"]) {
      expect(ratio("#ffffff", light[`color-${name}`]), name).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("gives form controls a >= 3:1 border in both themes", () => {
    expect(ratio(light["color-input"], light["color-paper"])).toBeGreaterThanOrEqual(3)
    expect(ratio(dark["color-input"], dark["color-paper"])).toBeGreaterThanOrEqual(3)
  })
})

describe("source hygiene (dark-mode regressions)", () => {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name)
      if (statSync(p).isDirectory()) {
        if (!/node_modules|\.next|pdf|emails|zz-theme-gallery/.test(name)) walk(p)
      } else if (/\.tsx$/.test(p) && !/opengraph-image|icon\.tsx|pwa-icon|apple-icon/.test(p)) files.push(p)
    }
  }
  walk(path.join(root, "app"))
  walk(path.join(root, "components"))
  const rel = (f: string) => path.relative(root, f).replace(/\\/g, "/")

  it("never pairs bg-ink with text-white (ink is near-white in dark mode; use text-paper)", () => {
    const bad: string[] = []
    for (const f of files) {
      const src = readFileSync(f, "utf8")
      for (const m of src.matchAll(/(?<![\w:\-[/])bg-ink(?![\w-])/g)) {
        let a = m.index!
        while (a > 0 && !/["'`]/.test(src[a - 1])) a--
        let b = m.index!
        while (b < src.length && !/["'`]/.test(src[b])) b++
        if (/(?<![\w:\-[/])text-white(?![\w\-/])/.test(src.slice(a, b))) bad.push(`${rel(f)}: ${src.slice(a, b).trim().slice(0, 80)}`)
      }
    }
    expect(bad).toEqual([])
  })

  it("does not hardcode the brand navy/orange as arbitrary colours on themed surfaces", () => {
    // Fixed-by-design files: the print ticket (paper document), the home hero
    // (fixed editorial palette) and the sample ticket. Everything else uses tokens.
    const allowed = /orders\/\[id\]\/print|app\/page\.tsx|SampleTicket|HeroEventTypesSlider|Footer/
    const bad: string[] = []
    for (const f of files) {
      if (allowed.test(rel(f))) continue
      const src = readFileSync(f, "utf8")
      for (const m of src.matchAll(/(?:text|bg|border|ring|from|to|via)-\[#(?:0a2540|f06d43|ff8a62|c9522a|fff3ed)\]/gi)) bad.push(`${rel(f)}: ${m[0]}`)
    }
    expect(bad).toEqual([])
  })

  it("has no inline gradient styles ending in hardcoded white (they stay light in dark mode)", () => {
    const bad = files.filter((f) => /style=\{\{[^}]*linear-gradient\([^)]*#(?:fff|ffffff)\s+\d+%/i.test(readFileSync(f, "utf8"))).map(rel)
    expect(bad).toEqual([])
  })
})
