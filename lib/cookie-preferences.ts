export const COOKIE_PREFERENCES_KEY = "tp_cookie_preferences_v1"
export const COOKIE_PREFERENCES_EVENT = "tp:cookie-preferences"
export const COOKIE_SETTINGS_EVENT = "tp:cookie-settings"
export const COOKIE_PREFERENCES_MAX_AGE = 180 * 24 * 60 * 60 * 1000

type CookiePreferences = { version: 1; analytics: boolean; savedAt: number }
let temporaryPreferences: CookiePreferences | null = null

function parsePreferences(raw: string | null): CookiePreferences | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    if (value?.version !== 1 || typeof value.analytics !== "boolean" ||
      typeof value.savedAt !== "number" || !Number.isFinite(value.savedAt) ||
      value.savedAt > Date.now() || Date.now() - value.savedAt >= COOKIE_PREFERENCES_MAX_AGE) return null
    return value
  } catch {
    return null
  }
}

export function getAnalyticsPreference(): boolean | null {
  if (typeof window === "undefined") return null
  let preferences = temporaryPreferences
  try {
    if (!preferences) preferences = parsePreferences(window.localStorage.getItem(COOKIE_PREFERENCES_KEY))
  } catch { /* A choice can still apply for this page when storage is blocked. */ }
  if (!preferences || Date.now() - preferences.savedAt >= COOKIE_PREFERENCES_MAX_AGE) return null
  return preferences.analytics
}

export function hasAnalyticsConsent() {
  return getAnalyticsPreference() === true
}

function clearAnalyticsStorage() {
  try {
    const storage = window.sessionStorage
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    for (const key of keys) {
      if (key === "tp_analytics_session" || key?.startsWith("tp_event_viewed:")) storage.removeItem(key)
    }
  } catch { /* Storage may be unavailable in private or restricted browsers. */ }
}

export function saveCookiePreferences(analytics: boolean) {
  const preferences: CookiePreferences = { version: 1, analytics, savedAt: Date.now() }
  temporaryPreferences = preferences
  try {
    window.localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(preferences))
    temporaryPreferences = null
  } catch { /* Remember this choice for the current page even if persistence fails. */ }
  if (!analytics) clearAnalyticsStorage()
  window.dispatchEvent(new Event(COOKIE_PREFERENCES_EVENT))
}

export function subscribeCookiePreferences(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== COOKIE_PREFERENCES_KEY && event.key !== null) return
    temporaryPreferences = null
    if (!hasAnalyticsConsent()) clearAnalyticsStorage()
    onChange()
  }
  window.addEventListener(COOKIE_PREFERENCES_EVENT, onChange)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(COOKIE_PREFERENCES_EVENT, onChange)
    window.removeEventListener("storage", onStorage)
  }
}
