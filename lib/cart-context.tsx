"use client"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

interface CartLineBase {
  key: string
  eventSlug: string
  eventTitle: string
  price: number
  currency: string
  qty: number
  eventStartsAt?: string
  eventEndsAt?: string
  eventVenue?: string
  /** Most this line may hold (per-order cap and remaining stock at add time). */
  maxQty?: number
}

export interface TicketLine     extends CartLineBase { kind: "ticket";       tierId: string;  tierName: string; emoji: string }
export interface MerchLine      extends CartLineBase { kind: "merch";        itemId: string;  name: string;     size?: string }
export interface VendorAddonLine extends CartLineBase { kind: "vendor_addon"; listingId: string; vendorName: string; packageName: string; category: string }

export type CartLine = TicketLine | MerchLine | VendorAddonLine

// Per-variant input types. Using a distributive union here (instead of
// Omit<CartLine, "key">) preserves each variant's required fields, so
// TypeScript narrows correctly when callers pass `kind: "ticket"` etc.
export type CartLineInput =
  | Omit<TicketLine,     "key">
  | Omit<MerchLine,      "key">
  | Omit<VendorAddonLine, "key">

export interface OrderRecord {
  id: string
  createdAt: string
  status: "paid" | "pending" | "completed" | "refunded" | "expired"
  items: CartLine[]
  totalsByCurrency: Record<string, number>
  contact: { name: string; email: string; phone: string }
  payment: { method: string }
}

interface CartContextValue {
  items: CartLine[]
  ready: boolean
  totalCount: number
  totalsByCurrency: Record<string, number>
  addItem: (item: CartLineInput) => void
  /** Upsert a line with exactly `item.qty` (used when the buyer goes straight to checkout). */
  setItem: (item: CartLineInput) => void
  removeItem: (key: string) => void
  updateQty: (key: string, qty: number) => void
  clear: () => void
  /** Put previously ordered lines back into the cart (e.g. after a cancelled card payment). */
  restoreItems: (lines: CartLine[]) => void
  /**
   * Record an order on this device and remove its lines from the cart. With
   * `eventSlug`, only that event's lines are ordered; other events stay in the cart.
   */
  placeOrder: (contact: OrderRecord["contact"], payment: OrderRecord["payment"], orderId?: string, status?: OrderRecord["status"], eventSlug?: string) => OrderRecord
  /** Save a server-provided order record on this device without touching the cart. */
  saveOrder: (order: OrderRecord) => void
  getOrders: () => OrderRecord[]
  getOrder: (id: string) => OrderRecord | null
}

const CartContext = createContext<CartContextValue | null>(null)
const STORAGE_KEY = "tp_cart"
const ORDERS_KEY = "tp_orders"

function keyFor(item: CartLineInput): string {
  if (item.kind === "ticket")       return `ticket:${item.eventSlug}:${item.tierId}`
  if (item.kind === "merch")        return `merch:${item.eventSlug}:${item.itemId}:${item.size ?? ""}`
  if (item.kind === "vendor_addon") return `vendor_addon:${item.eventSlug}:${item.listingId}`
  return "item:unknown"
}

function clampQty(qty: number, maxQty?: number): number {
  return typeof maxQty === "number" && maxQty > 0 ? Math.min(qty, maxQty) : qty
}

function makeOrderId(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  const time = Date.now().toString(36).slice(-4).toUpperCase()
  return `TP-${time}${rand}`
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) setItems(JSON.parse(raw))
      } catch (err) { console.warn("[cart] hydrate", err) }
      setReady(true)
    })
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch (err) { console.warn("[cart] persist cart", err) }
  }, [items, ready])

  const addItem = useCallback((item: CartLineInput) => {
    const key = keyFor(item)
    setItems((prev) => {
      const existing = prev.find((p) => p.key === key)
      if (existing) {
        const maxQty = item.maxQty ?? existing.maxQty
        return prev.map((p) => (p.key === key ? { ...p, maxQty, qty: clampQty(p.qty + item.qty, maxQty) } : p))
      }
      return [...prev, { ...item, key, qty: clampQty(item.qty, item.maxQty) } as CartLine]
    })
  }, [])

  const setItem = useCallback((item: CartLineInput) => {
    const key = keyFor(item)
    setItems((prev) => {
      const line = { ...item, key, qty: clampQty(item.qty, item.maxQty) } as CartLine
      if (prev.some((p) => p.key === key)) return prev.map((p) => (p.key === key ? line : p))
      return [...prev, line]
    })
  }, [])

  const restoreItems = useCallback((lines: CartLine[]) => {
    setItems((prev) => {
      const next = [...prev]
      for (const raw of lines) {
        // Server-built order lines use different keys; re-key them for the cart.
        const { key: _serverKey, ...input } = raw
        void _serverKey
        const line = { ...input, key: keyFor(input as CartLineInput) } as CartLine
        const i = next.findIndex((p) => p.key === line.key)
        if (i >= 0) next[i] = line
        else next.push(line)
      }
      return next
    })
  }, [])

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((p) => p.key !== key))
  }, [])

  const updateQty = useCallback((key: string, qty: number) => {
    setItems((prev) => (qty < 1 ? prev.filter((p) => p.key !== key) : prev.map((p) => (p.key === key ? { ...p, qty: clampQty(qty, p.maxQty) } : p))))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const totalCount = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items])

  const totalsByCurrency = useMemo(
    () =>
      items.reduce<Record<string, number>>((acc, i) => {
        acc[i.currency] = (acc[i.currency] ?? 0) + i.price * i.qty
        return acc
      }, {}),
    [items]
  )

  const getOrders = useCallback((): OrderRecord[] => {
    try {
      const raw = localStorage.getItem(ORDERS_KEY)
      return raw ? (JSON.parse(raw) as OrderRecord[]) : []
    } catch (err) { console.warn("[cart] read orders", err); return [] }
  }, [])

  const getOrder = useCallback((id: string): OrderRecord | null => {
    return getOrders().find((o) => o.id === id) ?? null
  }, [getOrders])

  const saveOrder = useCallback((order: OrderRecord) => {
    try {
      const existing = getOrders().filter((o) => o.id !== order.id)
      localStorage.setItem(ORDERS_KEY, JSON.stringify([order, ...existing]))
    } catch (err) {
      // The server order is authoritative. Private browsing, quota limits, or
      // storage policy must not turn a completed payment into a false failure.
      console.warn("[cart] saveOrder persist", err)
    }
  }, [getOrders])

  const placeOrder = useCallback(
    (contact: OrderRecord["contact"], payment: OrderRecord["payment"], orderId?: string, status?: OrderRecord["status"], eventSlug?: string): OrderRecord => {
      const ordered = eventSlug ? items.filter((i) => i.eventSlug === eventSlug) : items
      const order: OrderRecord = {
        id: orderId ?? makeOrderId(),
        createdAt: new Date().toISOString(),
        status: status ?? "paid",
        items: [...ordered],
        totalsByCurrency: ordered.reduce<Record<string, number>>((acc, i) => {
          acc[i.currency] = (acc[i.currency] ?? 0) + i.price * i.qty
          return acc
        }, {}),
        contact,
        payment,
      }
      saveOrder(order)
      const orderedKeys = new Set(ordered.map((i) => i.key))
      setItems((prev) => prev.filter((p) => !orderedKeys.has(p.key)))
      return order
    },
    [items, saveOrder]
  )

  return (
    <CartContext.Provider value={{ items, ready, totalCount, totalsByCurrency, addItem, setItem, removeItem, updateQty, clear, restoreItems, placeOrder, saveOrder, getOrders, getOrder }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within CartProvider")
  return ctx
}
