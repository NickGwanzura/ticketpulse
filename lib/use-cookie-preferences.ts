"use client"

import { useSyncExternalStore } from "react"
import { getAnalyticsPreference, subscribeCookiePreferences } from "./cookie-preferences"

const serverPreference = (): undefined => undefined

export function useCookiePreferences() {
  return useSyncExternalStore(subscribeCookiePreferences, getAnalyticsPreference, serverPreference)
}
