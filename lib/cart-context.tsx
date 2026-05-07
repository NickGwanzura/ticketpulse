"use client"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

export type CartLine =
  | {
      kind: "ticket"
      key: string
      eventSlug: string
      eventTitle: string
      tierId: string
      tierName: string
      emoji: string
      price: number
      currency: string
      qty: number
    }
  | {
      kind: "merch"
      key: string
      eventSlug: string
      eventTitle: string
      itemId: string
      name: string
      size?: string
      price: number
      currency: string
      qty: number
    }
  | {
      kind: "shuttle"
      key: string
      eventSlug: string
      eventTitle: string
      routeId: string
      description: string
      price: number
      currency: string
      qty: number
    }

export interface OrderRecord {
  id: string
  createdAt: string
  status: "paid" | "pending" | "refunded"
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
  addItem: (item: Omit<CartLine, "key">) => void
  removeItem: (key: string) => void
  updateQty: (key: string, qty: number) => void
  clear: () => void
  placeOrder: (contact: OrderRecord["contact"], payment: OrderRecord["payment"]) => OrderRecord
  getOrders: () => OrderRecord[]
  getOrder: (id: string) => OrderRecord | null
}

const CartContext = createContext<CartContextValue | null>(null)
const STORAGE_KEY = "tp_cart"
const ORDERS_KEY = "tp_orders"

function keyFor(item: Omit<CartLine, "key">): string {
  if (item.kind === "ticket")  return `ticket:${item.eventSlug}:${item.tierId}`
  if (item.kind === "merch")   return `merch:${item.eventSlug}:${item.itemId}:${item.size ?? ""}`
  return `shuttle:${item.eventSlug}:${item.routeId}`
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
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch {}
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {}
  }, [items, ready])

  const addItem = useCallback((item: Omit<CartLine, "key">) => {
    const key = keyFor(item)
    setItems((prev) => {
      const existing = prev.find((p) => p.key === key)
      if (existing) return prev.map((p) => (p.key === key ? { ...p, qty: p.qty + item.qty } : p))
      return [...prev, { ...item, key } as CartLine]
    })
  }, [])

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((p) => p.key !== key))
  }, [])

  const updateQty = useCallback((key: string, qty: number) => {
    setItems((prev) => (qty < 1 ? prev.filter((p) => p.key !== key) : prev.map((p) => (p.key === key ? { ...p, qty } : p))))
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
    } catch { return [] }
  }, [])

  const getOrder = useCallback((id: string): OrderRecord | null => {
    return getOrders().find((o) => o.id === id) ?? null
  }, [getOrders])

  const placeOrder = useCallback(
    (contact: OrderRecord["contact"], payment: OrderRecord["payment"]): OrderRecord => {
      const order: OrderRecord = {
        id: makeOrderId(),
        createdAt: new Date().toISOString(),
        status: "paid",
        items: [...items],
        totalsByCurrency: { ...totalsByCurrency },
        contact,
        payment,
      }
      try {
        const existing = getOrders()
        localStorage.setItem(ORDERS_KEY, JSON.stringify([order, ...existing]))
      } catch {}
      setItems([])
      return order
    },
    [items, totalsByCurrency, getOrders]
  )

  return (
    <CartContext.Provider value={{ items, ready, totalCount, totalsByCurrency, addItem, removeItem, updateQty, clear, placeOrder, getOrders, getOrder }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within CartProvider")
  return ctx
}
