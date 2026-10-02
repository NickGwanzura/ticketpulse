import { beforeEach, describe, expect, it } from "vitest"
import {
  COOKIE_PREFERENCES_KEY,
  getAnalyticsPreference,
  hasAnalyticsConsent,
  saveCookiePreferences,
} from "@/lib/cookie-preferences"

describe("cookie preferences", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it("does not assume analytics consent before a choice", () => {
    expect(getAnalyticsPreference()).toBeNull()
    expect(hasAnalyticsConsent()).toBe(false)
  })

  it("persists an essential-only choice", () => {
    window.sessionStorage.setItem("tp_analytics_session", "session")
    window.sessionStorage.setItem("tp_event_viewed:event", "1")

    saveCookiePreferences(false)

    expect(getAnalyticsPreference()).toBe(false)
    expect(hasAnalyticsConsent()).toBe(false)
    expect(window.localStorage.getItem(COOKIE_PREFERENCES_KEY)).toContain('"analytics":false')
    expect(window.sessionStorage.getItem("tp_analytics_session")).toBeNull()
    expect(window.sessionStorage.getItem("tp_event_viewed:event")).toBeNull()
  })

  it("allows analytics only after an explicit opt-in", () => {
    saveCookiePreferences(true)

    expect(getAnalyticsPreference()).toBe(true)
    expect(hasAnalyticsConsent()).toBe(true)
    expect(window.localStorage.getItem(COOKIE_PREFERENCES_KEY)).toContain('"analytics":true')
  })
})
