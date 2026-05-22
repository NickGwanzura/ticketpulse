"use client"

import { useState, useCallback } from "react"

export function useAiGenerate<T>() {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async (url: string, body: object) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const json = (await res.json()) as T
      setData(json)
      return json
    } catch {
      setError("Failed to generate.")
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, generate }
}
