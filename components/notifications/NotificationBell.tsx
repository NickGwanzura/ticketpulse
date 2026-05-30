"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Link from "next/link"
import { Bell, Check, CheckCheck, Loader2 } from "lucide-react"

export type NotificationItem = {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  read: boolean
  createdAt: string
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return "Just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function typeIcon(type: string): string {
  const map: Record<string, string> = {
    order_paid: "💰",
    order_cancelled: "❌",
    order_refunded: "↩️",
    ticket_issued: "🎟️",
    ticket_checked_in: "✅",
    payout_requested: "📤",
    payout_paid: "💵",
    event_published: "📢",
    event_sold_out: "🔥",
    system: "🔔",
  }
  return map[type] ?? "🔔"
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [marking, setMarking] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20")
      if (!res.ok) return
      const data = (await res.json()) as {
        notifications: NotificationItem[]
        unreadCount: number
      }
      setItems(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {
      // silently fail
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Refresh every 60s when panel is closed
  useEffect(() => {
    if (open) return
    const id = setInterval(fetchNotifications, 60000)
    return () => clearInterval(id)
  }, [open, fetchNotifications])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // SSE connection for real-time updates
  useEffect(() => {
    const es = new EventSource("/api/notifications/stream")
    es.addEventListener("connected", () => {
      // Connection established
    })
    es.addEventListener("heartbeat", () => {
      // Keep-alive
    })
    es.onerror = () => {
      es.close()
    }
    return () => es.close()
  }, [])

  const markRead = async (id: string) => {
    setMarking(true)
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      })
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    } finally {
      setMarking(false)
    }
  }

  const markAllRead = async () => {
    setMarking(true)
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      })
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setOpen((o) => !o)
          if (!open) fetchNotifications()
        }}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg text-ink-2 hover:text-ink hover:bg-paper-2 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-1rem)] rounded-2xl border border-line bg-paper shadow-xl shadow-black/5 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="text-[13px] font-semibold text-ink">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={marking}
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-navy hover:text-brand-600 disabled:opacity-50 transition-colors"
              >
                {marking ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <CheckCheck size={11} />
                )}
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={20} className="mx-auto text-ink-3 mb-2" />
                <p className="text-[12.5px] text-ink-3">No notifications yet</p>
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-line last:border-b-0 hover:bg-paper-2 transition-colors ${
                    n.read ? "opacity-70" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-base shrink-0">{typeIcon(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12.5px] font-semibold text-ink leading-snug">
                          {n.link ? (
                            <Link
                              href={n.link}
                              onClick={() => !n.read && markRead(n.id)}
                              className="hover:text-navy hover:underline"
                            >
                              {n.title}
                            </Link>
                          ) : (
                            n.title
                          )}
                        </p>
                        {!n.read && (
                          <button
                            onClick={() => markRead(n.id)}
                            disabled={marking}
                            className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-ink-3 hover:text-navy hover:bg-paper-2 disabled:opacity-50 transition-colors"
                            title="Mark as read"
                          >
                            <Check size={12} />
                          </button>
                        )}
                      </div>
                      <p className="text-[11.5px] text-ink-2 mt-0.5 leading-relaxed">
                        {n.body}
                      </p>
                      <p className="text-[10.5px] text-ink-3 mt-1">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
