"use client"

import { useState, useCallback } from "react"
import { Share2, Check } from "lucide-react"

interface Props {
  eventTitle: string
  eventDescription?: string | null
}

export default function ShareEventButton({ eventTitle, eventDescription }: Props) {
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(async () => {
    const url = window.location.href

    // Try Web Share API first (mobile / supported browsers)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: eventTitle,
          text: eventDescription ?? `Check out ${eventTitle}`,
          url,
        })
        return
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    }

    // Fallback: copy link to clipboard
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — silently fail
    }
  }, [eventTitle, eventDescription])

  return (
    <button
      type="button"
      aria-label="Share event"
      onClick={handleShare}
      className="border border-line bg-paper text-ink-2 rounded-lg p-2.5 hover:text-ink hover:border-line-2 transition-colors relative"
    >
      {copied ? <Check size={15} className="text-green-500" /> : <Share2 size={15} />}

      {copied && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-ink text-paper text-[11px] font-medium px-2 py-1 rounded-md shadow-sm pointer-events-none">
          Link copied!
        </span>
      )}
    </button>
  )
}
