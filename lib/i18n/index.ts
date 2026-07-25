import { locales, DEFAULT_LOCALE, type Locale, type MessageKey } from "./dictionary"

export type { Locale, MessageKey }
export { DEFAULT_LOCALE }

/** Translate a key for a given locale, falling back to English. */
export function t(key: MessageKey, locale: Locale = DEFAULT_LOCALE): string {
  return locales[locale]?.[key] ?? locales[DEFAULT_LOCALE][key] ?? key
}

/**
 * Locale-aware currency/date formatting already existed ad hoc (several
 * places hardcode "en-GB"/"en-US"); this centralizes the mapping so a real
 * locale switch only has to change one place instead of every call site.
 */
const CURRENCY_LOCALE_MAP: Record<Locale, string> = {
  en: "en-US",
}

export function localeForLocale(locale: Locale = DEFAULT_LOCALE): string {
  return CURRENCY_LOCALE_MAP[locale] ?? "en-US"
}
