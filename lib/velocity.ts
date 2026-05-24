import "server-only"
import { log } from "@/lib/logger"

const BASE_URL = process.env.VELOCITY_API_URL?.replace(/\/$/, "") || "https://api.velocityafrica.net"
const API_KEY = process.env.VELOCITY_API_KEY
const MERCHANT_PHONE = process.env.VELOCITY_MERCHANT_PHONE
const MERCHANT_ACCOUNT = process.env.VELOCITY_MERCHANT_ACCOUNT
const VELOCITY_ITEM_CODE = process.env.VELOCITY_ITEM_CODE

// Auth modes:
//  bearer      → Authorization: Bearer <key>  (default)
//  x-api-key   → X-API-Key: <key>
//  api-key     → api-key: <key>
//  raw         → Authorization: <key>  (no Bearer prefix)
//  query       → ?apiKey=<key> appended to URL
const AUTH_MODE = (process.env.VELOCITY_AUTH_MODE || "bearer") as "bearer" | "x-api-key" | "api-key" | "raw" | "query"

function buildAuthHeaders(): Record<string, string> {
  if (!API_KEY) throw new Error("VELOCITY_API_KEY not set")
  switch (AUTH_MODE) {
    case "x-api-key":
      return { "X-API-Key": API_KEY }
    case "api-key":
      return { "api-key": API_KEY }
    case "raw":
      return { Authorization: API_KEY }
    case "bearer":
    default:
      return { Authorization: `Bearer ${API_KEY}` }
  }
}

function buildUrl(path: string): string {
  const url = `${BASE_URL}${path}`
  if (AUTH_MODE === "query" && API_KEY) {
    const sep = url.includes("?") ? "&" : "?"
    return `${url}${sep}apiKey=${encodeURIComponent(API_KEY)}`
  }
  return url
}

async function velocityFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const url = buildUrl(path)
  const headers: Record<string, string> = {
    ...buildAuthHeaders(),
    "Content-Type": "application/json",
    ...(opts?.headers as Record<string, string> || {}),
  }

  log.info("velocity — request", { method: opts?.method || "GET", path, body: opts?.body })

  const res = await fetch(url, {
    ...opts,
    headers,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    log.error("velocity — API error", {
      method: opts?.method || "GET",
      path,
      url,
      status: res.status,
      authMode: AUTH_MODE,
      body: opts?.body,
      response: text,
    })
    throw new Error(`Velocity ${opts?.method || "GET"} ${path} → ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface VelocityItem {
  itemCode: string
  itemName: string
  unitPrice: number
  currencyCodeString: string
}

export interface VelocityCustomer {
  customerUid: string
  customerName?: string
  customerPhone?: string
}

export interface VelocitySalesOrder {
  trace: string
  workflowId: string
  status: string
}

export interface VelocityTransaction {
  trace: string
  paymentStatus: string
  pollStatus: "PENDING" | "SUCCESS" | "FAILED"
  redirectUrl?: string
}

export interface VelocityPollResult {
  paymentStatus: string
  pollStatus: "PENDING" | "SUCCESS" | "FAILED"
}

export interface VelocityOrderMetadata {
  salesOrderTrace: string
  transactionTrace: string
  workflowId: string
}

// ── Methods ─────────────────────────────────────────────────────────────────

export async function fetchVelocityItems(itemCode?: string): Promise<VelocityItem[]> {
  const qs = itemCode ? `?itemCode=${encodeURIComponent(itemCode)}` : ""
  return velocityFetch<VelocityItem[]>(`/items${qs}`)
}

export async function fetchVelocityCustomer(phone: string): Promise<VelocityCustomer | null> {
  try {
    const data = await velocityFetch<VelocityCustomer>(`/customers?phone=${encodeURIComponent(phone)}`)
    return data
  } catch (err) {
    log.info("velocity — customer not found, will use default", { phone, error: String(err) })
    return null
  }
}

export async function createVelocitySalesOrder(payload: {
  currency: string
  customerId: string | null
  amount: number
  notes?: string
  orderDate?: string
  dueDate?: string
}): Promise<VelocitySalesOrder> {
  const body: Record<string, unknown> = {
    currencyCodeString: payload.currency,
    orderDate: payload.orderDate || new Date().toISOString().split("T")[0],
    dueDate: payload.dueDate || payload.orderDate || new Date().toISOString().split("T")[0],
    notes: payload.notes || "TicketPulse order",
    authorized: true,
    items: VELOCITY_ITEM_CODE
      ? [
          {
            itemCode: VELOCITY_ITEM_CODE,
            qty: 1,
            unitPrice: payload.amount,
            amount: payload.amount,
          },
        ]
      : [],
    charges: [{ amount: 0 }],
  }
  // Only send customerIdString if we have a real UUID. Velocity uses a default
  // customer when the field is omitted.
  if (payload.customerId) {
    body.customerIdString = payload.customerId
  }
  return velocityFetch<VelocitySalesOrder>("/sales-orders", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function initiateVelocityTransaction(payload: {
  amount: number
  processor: "ECOCASH" | "VMC"
  debitPhone: string
  debitCurrency: string
  authType: "REMOTE" | "WEB"
  salesOrderId: string
}): Promise<VelocityTransaction> {
  if (!MERCHANT_PHONE || !MERCHANT_ACCOUNT) {
    throw new Error("VELOCITY_MERCHANT_PHONE / VELOCITY_MERCHANT_ACCOUNT not set")
  }
  const body = {
    amount: payload.amount,
    paymentProcessorLabel: payload.processor,
    debitPhone: payload.debitPhone,
    debitRegion: "ZW",
    debitCurrency: payload.debitCurrency,
    debitRef: "velocityafrica",
    creditPhone: MERCHANT_PHONE,
    creditRegion: "ZW",
    creditAccount: MERCHANT_ACCOUNT,
    type: "REQUEST",
    authType: payload.authType,
    salesOrderId: payload.salesOrderId,
  }
  return velocityFetch<VelocityTransaction>("/transactions", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function pollVelocityTransaction(trace: string): Promise<VelocityPollResult> {
  return velocityFetch<VelocityPollResult>(`/transactions/poll/${encodeURIComponent(trace)}`, {
    method: "PUT",
  })
}

export async function completeVelocitySalesOrder(trace: string): Promise<{ status: string }> {
  return velocityFetch<{ status: string }>(`/sales-orders/update-workflow/${encodeURIComponent(trace)}`, {
    method: "PUT",
  })
}

export function velocityUrls(orderId: string, origin: string) {
  const base = origin.replace(/\/$/, "")
  return {
    returnUrl: `${base}/api/checkout/velocity/return/${orderId}`,
    webhookUrl: `${base}/api/checkout/velocity/webhook`,
  }
}
