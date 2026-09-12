"use client"
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react"
import { Heart } from "lucide-react"

export default function SaveFavoriteButton({ eventId }: { eventId: string }) {
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem("tp:favourites")
    if (stored) {
      const ids = JSON.parse(stored) as string[]
      setSaved(ids.includes(eventId))
    }
  }, [eventId])

  const toggle = () => {
    const stored = window.localStorage.getItem("tp:favourites")
    const ids: string[] = stored ? JSON.parse(stored) : []
    const next = saved ? ids.filter((id) => id !== eventId) : [...ids, eventId]
    window.localStorage.setItem("tp:favourites", JSON.stringify(next))
    setSaved(!saved)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={saved ? "Remove from favourites" : "Save to favourites"}
      className={`border bg-paper rounded-lg p-2.5 transition-colors ${
        saved
          ? "border-rose-200 text-rose-600 hover:text-rose-700 hover:border-rose-300"
          : "border-line text-ink-2 hover:text-rose-600 hover:border-line-2"
      }`}
    >
      <Heart size={15} fill={saved ? "currentColor" : "none"} />
    </button>
  )
}
