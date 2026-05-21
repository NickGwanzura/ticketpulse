"use client"

import { useEffect } from "react"

export default function PwaRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    )
      return

    // Register SW on idle so it doesn't block initial render
    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => registerSw(), { timeout: 5000 })
    } else {
      setTimeout(registerSw, 3000)
    }
  }, [])

  return null
}

async function registerSw() {
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" })
  } catch {
    // Service worker registration failed — not critical
  }
}
