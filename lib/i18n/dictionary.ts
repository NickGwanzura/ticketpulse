/**
 * Message dictionary — scaffolding, not a translation. TicketPulse is
 * single-market (Zimbabwe/English) with strings hardcoded across hundreds
 * of components; rewriting all of it for real multi-language support is a
 * multi-week project that needs a translation vendor and target-language
 * decision, not something to fake here. This gives the next person a
 * working pattern and one real locale (en) to extend from, rather than
 * nothing at all.
 *
 * To add a language: add a key to `locales` below with the same shape as
 * `en`, then `t("nav.dashboard", locale)` picks it up automatically.
 */

export const locales = {
  en: {
    "nav.dashboard": "Dashboard",
    "nav.orders": "Orders",
    "nav.payouts": "Payouts",
    "nav.scan": "Scan",
    "payouts.available": "Available balance",
    "payouts.paidOut": "Paid out",
    "payouts.pending": "Pending payouts",
    "payouts.request": "Request payout",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.loading": "Loading…",
  },
} as const

export type Locale = keyof typeof locales
export type MessageKey = keyof (typeof locales)["en"]

export const DEFAULT_LOCALE: Locale = "en"
