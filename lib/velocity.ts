import "server-only"
import { log } from "@/lib/logger"

const BASE_URL = process.env.VELOCITY_API_URL?.replace(/\/$/, "") || "https://api.velocityafrica.net"
const API_KEY = process.env.VELOCITY_API_KEY
const MERCHANT_PHONE = process.env.VELOCITY_MERCHANT_PHONE
const MERCHANT_ACCOUNT = process.env.VELOCITY_MERCHANT_ACCOUNT
const VELOCITY_ITEM_CODE = process.env.VELOCITY_ITEM_CODE

function authHeaders(): Record<string, string> {
  if (!API_KEY) throw new Error("VELOCITY_API_KEY not set")
  // Default: Bearer token. Override VELOCITY_AUTH_HEADER if Velocity uses a custom header.
  const headerName = process.env.VELOCITY_AUTH_HEADER || "Authorization"
  const headerValue = headerName === "Authorization" ? `Bearer ${API_KEY}` : API_KEY
  return {
    [headerName]: headerValue,
    "Content-Type": "application/json",
  }
}

async function velocityFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    ...opts,
    headers: {
      ...authHeaders(),
      ...(opts?.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
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
  customerId: string
  amount: number
  notes?: string
  orderDate?: string
  dueDate?: string
}): Promise<VelocitySalesOrder> {
  const body = {
    currencyCodeString: payload.currency,
    customerIdString: payload.customerId,
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
  salesOrderTrace: string
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
    salesOrderId: payload.salesOrderTrace,
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
