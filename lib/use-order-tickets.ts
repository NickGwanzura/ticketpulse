"use client"
import { useEffect, useState } from "react"

export type TicketRecord = {
  id: string
  qrCode: string | null
  tierId: string | null
  tierName: string | null
  scannedAt: string | null
  transferToEmail: string | null
  transferToName: string | null
  transferExpiresAt: string | null
  transferredAt: string | null
  holderName: string | null
  holderEmail: string | null
}

/**
 * Fetches real ticket QR codes for an order from `/api/orders/{id}/tickets`,
 * polling every 2s (up to 30s) while the result is empty — tickets are created
 * asynchronously after payment, so they may not exist on the first request.
 *
 * Returns the raw records plus a `qrByTier` map (tierId → QR codes in insertion
 * order) for rendering, and a `loading` flag that stays true while still polling
 * for an empty result.
 */
export function useOrderTickets(orderId: string, enabled: boolean) {
  const [records, setRecords] = useState<TicketRecord[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || !orderId) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const start = Date.now()
    const MAX_MS = 30_000
    const INTERVAL_MS = 2_000

    setLoading(true)

    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/tickets`)
        const data: TicketRecord[] = res.ok ? await res.json() : []
        if (cancelled) return
        if (Array.isArray(data) && data.length > 0) {
          setRecords(data)
          setLoading(false)
          return
        }
      } catch {
        if (cancelled) return
      }
      if (Date.now() - start >= MAX_MS) {
        if (!cancelled) setLoading(false)
        return
      }
      timer = setTimeout(poll, INTERVAL_MS)
    }

    poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [orderId, enabled])

  const qrByTier = new Map<string, string[]>()
  const recordsByTier = new Map<string, TicketRecord[]>()
  for (const t of records) {
    if (!t.tierId) continue
    if (t.qrCode) {
      if (!qrByTier.has(t.tierId)) qrByTier.set(t.tierId, [])
      qrByTier.get(t.tierId)!.push(t.qrCode)
    }
    if (!recordsByTier.has(t.tierId)) recordsByTier.set(t.tierId, [])
    recordsByTier.get(t.tierId)!.push(t)
  }

  return { records, qrByTier, recordsByTier, loading }
}
