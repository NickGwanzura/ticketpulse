/**
 * Theme runtime — single source of truth for how light/dark is chosen, stored
 * and applied. The CSS side lives in app/globals.css (`:root[data-theme="dark"]`).
 *
 *   preference  "light" | "dark" | "system"   (what the user chose; persisted)
 *   resolved    "light" | "dark"              (what is actually painted)
 *
 * <html> carries both as attributes:
 *   data-theme       resolved — the only thing the stylesheet keys off
 *   data-theme-pref  preference — lets the toggle pick its icon in CSS, so it
 *                    is right on first paint with no React state to hydrate
 *
 * THEME_INIT_SCRIPT runs synchronously in <head>, before first paint, so a
 * returning visitor never sees the wrong theme flash. Theme changes only touch
 * these attributes — never React state — so application state is unaffected.
 */

export type ThemePreference = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

/** Same key the admin-only toggle used, so existing choices carry over. */
export const THEME_STORAGE_KEY = "ticketpulse-theme"

/** Fired on `window` after this tab changes the preference (the `storage` event covers other tabs). */
export const THEME_CHANGE_EVENT = "ticketpulse-theme-change"

/** Browser-chrome colours (status bar / PWA title bar) per resolved theme. */
export const THEME_CHROME_COLOR: Record<ResolvedTheme, string> = {
  light: "#0a2540",
  dark: "#0f1620",
}

const DARK_QUERY = "(prefers-color-scheme: dark)"

export function parsePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system"
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light"
  return preference
}

/** Order the toggle cycles through. */
export function nextPreference(current: ThemePreference): ThemePreference {
  return current === "light" ? "dark" : current === "dark" ? "system" : "light"
}

/**
 * Inline script for <head>. Kept dependency-free and defensive: storage can
 * throw (private mode, blocked cookies) and matchMedia may be missing; in every
 * failure case it falls back to the light theme rather than throwing.
 */
export const THEME_INIT_SCRIPT = `(function(){var r="light",p="system";try{var s=null;try{s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})}catch(e){}p=s==="light"||s==="dark"?s:"system";r=p==="system"?(window.matchMedia&&window.matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches?"dark":"light"):p}catch(e){}var d=document.documentElement;d.setAttribute("data-theme",r);d.setAttribute("data-theme-pref",p);d.style.colorScheme=r;var c=r==="dark"?${JSON.stringify(
  THEME_CHROME_COLOR.dark,
)}:${JSON.stringify(THEME_CHROME_COLOR.light)};var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++){m[i].setAttribute("content",c);m[i].removeAttribute("media")}})();`

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches
}

export function readStoredPreference(): ThemePreference {
  try {
    return parsePreference(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return "system"
  }
}

/** While set, every apply paints this theme regardless of preference (see lockTheme). */
let lockedTheme: ResolvedTheme | null = null

/**
 * Pins the page to one theme — for document-like routes (printable tickets)
 * that are paper and must not follow dark mode. Returns the unlock function;
 * unlocking repaints the user's real preference.
 */
export function lockTheme(theme: ResolvedTheme): () => void {
  lockedTheme = theme
  applyTheme(readStoredPreference())
  return () => {
    lockedTheme = null
    applyTheme(readStoredPreference())
  }
}

/** Paints a preference: sets the attributes and the browser-chrome colour. */
export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = lockedTheme ?? resolveTheme(preference, systemPrefersDark())
  const root = document.documentElement
  root.setAttribute("data-theme", resolved)
  root.setAttribute("data-theme-pref", preference)
  root.style.colorScheme = resolved

  const metas = document.querySelectorAll('meta[name="theme-color"]')
  if (metas.length === 0) {
    const meta = document.createElement("meta")
    meta.name = "theme-color"
    meta.content = THEME_CHROME_COLOR[resolved]
    document.head.appendChild(meta)
  } else {
    metas.forEach((meta) => {
      meta.setAttribute("content", THEME_CHROME_COLOR[resolved])
      meta.removeAttribute("media")
    })
  }
  return resolved
}

/** Persists and applies a preference. Storage failure still applies it for this session. */
export function setThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    /* private mode / storage blocked — the choice just won't persist */
  }
  applyTheme(preference)
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT))
}

/**
 * Keeps the page in sync with the outside world: the OS scheme changing while
 * on "system", and the preference changing in another tab. Returns a cleanup.
 */
export function watchTheme(onChange?: () => void): () => void {
  const mql = typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null

  const onSystemChange = () => {
    if (readStoredPreference() === "system") {
      applyTheme("system")
      onChange?.()
    }
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      applyTheme(readStoredPreference())
      onChange?.()
    }
  }
  const onLocal = () => onChange?.()

  mql?.addEventListener("change", onSystemChange)
  window.addEventListener("storage", onStorage)
  window.addEventListener(THEME_CHANGE_EVENT, onLocal)
  return () => {
    mql?.removeEventListener("change", onSystemChange)
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(THEME_CHANGE_EVENT, onLocal)
  }
}
