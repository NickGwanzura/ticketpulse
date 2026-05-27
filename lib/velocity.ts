import "server-only"
import { log } from "@/lib/logger"

const BASE_URL = process.env.VELOCITY_API_URL?.replace(/\/$/, "") || "https://api.velocityafrica.net"
const API_KEY = process.env.VELOCITY_API_KEY
const MERCHANT_PHONE = process.env.VELOCITY_MERCHANT_PHONE
const MERCHANT_ACCOUNT = process.env.VELOCITY_MERCHANT_ACCOUNT
const VELOCITY_TICKET_ITEM_CODE = process.env.VELOCITY_TICKET_ITEM_CODE

const FETCH_TIMEOUT_MS = 15_000
const DEBIT_REGION = process.env.VELOCITY_DEBIT_REGION || "ZW"
const DEBIT_REF = process.env.VELOCITY_DEBIT_REF || "velocityafrica"

// UUID v4 regex for validating customer IDs
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Auth modes:
//  bearer      → Authorization: Bearer <key>  (default)
//  x-api-key   → X-API-Key: <key>
//  api-key     → api-key: <key>
//  raw         → Authorization: <key>  (no Bearer prefix)
//  query       → ?apiKey=<key> appended to URL
const AUTH_MODE = (process.env.VELOCITY_AUTH_MODE || "bearer") as "bearer" | "x-api-key" | "api-key" | "raw" | "query"

// ── Startup environment validation ────────────────────────────────────────

function checkEnv(required: boolean, key: string, value: string | undefined): string | null {
  if (!value || !value.trim()) {
    if (required) {
      log.error("velocity — missing required env var", { key })
      return null
    }
    log.warn("velocity — optional env var not set", { key })
    return null
  }
  return value.trim()
}

let envValidated = false
function validateEnv() {
  if (envValidated) return
  const required = [
    ["VELOCITY_API_KEY", API_KEY],
    ["VELOCITY_MERCHANT_PHONE", MERCHANT_PHONE],
    ["VELOCITY_MERCHANT_ACCOUNT", MERCHANT_ACCOUNT],
    ["VELOCITY_TICKET_ITEM_CODE", VELOCITY_TICKET_ITEM_CODE],
  ] as const
  const missing = required.filter(([, v]) => !v || !v.trim()).map(([k]) => k)
  if (missing.length > 0) {
    log.error("velocity — missing required env vars", { missing })
    throw new Error(`Velocity — missing required env vars: ${missing.join(", ")}`)
  }
  log.info("velocity — env validated", {
    baseUrl: BASE_URL,
    authMode: AUTH_MODE,
    merchantPhoneSet: !!MERCHANT_PHONE,
    merchantAccountSet: !!MERCHANT_ACCOUNT,
    itemCodeSet: !!VELOCITY_TICKET_ITEM_CODE,
    apiKeySet: !!API_KEY,
    debitRegion: DEBIT_REGION,
    debitRef: DEBIT_REF,
  })
  envValidated = true
}

// ── Auth helpers ──────────────────────────────────────────────────────────

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

// ── Payload sanitization ──────────────────────────────────────────────────

function sanitizePayload(body: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) {
      log.warn("velocity — sanitize: stripping null/undefined field", { field: key })
      continue
    }
    if (typeof value === "string") {
      const trimmed = value.trim()
      if (trimmed.length === 0) {
        log.warn("velocity — sanitize: stripping empty string field", { field: key })
        continue
      }
      cleaned[key] = trimmed
    } else if (typeof value === "number" && !Number.isFinite(value)) {
      log.warn("velocity — sanitize: stripping non-finite number", { field: key, value })
      continue
    } else {
      cleaned[key] = value
    }
  }
  return cleaned
}

function maskSecret(val: string): string {
  if (val.length <= 8) return "***"
  return val.slice(0, 4) + "****" + val.slice(-4)
}

function isValidUUID(str: string | null | undefined): boolean {
  return typeof str === "string" && UUID_RE.test(str)
}

// ── Pre-validation ────────────────────────────────────────────────────────

function validateRequiredFields(fields: Record<string, unknown>, label: string): string[] {
  const missing: string[] = []
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) {
      missing.push(key)
    } else if (typeof value === "string" && value.trim().length === 0) {
      missing.push(key)
    } else if (typeof value === "number" && (!Number.isFinite(value) || value <= 0)) {
      missing.push(`${key} (invalid: ${value})`)
    }
  }
  if (missing.length > 0) {
    log.error("velocity — pre-validation failed", { label, missingFields: missing })
  }
  return missing
}

// ── Core HTTP client ──────────────────────────────────────────────────────

async function velocityFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  validateEnv()

  const url = buildUrl(path)
  const headers: Record<string, string> = {
    ...buildAuthHeaders(),
    "Content-Type": "application/json",
    ...(opts?.headers as Record<string, string> || {}),
  }

  // Log the request (mask API key in URL for query mode)
  const safeUrl = AUTH_MODE === "query" ? url.replace(API_KEY || "", maskSecret(API_KEY || "")) : url
  log.info("velocity — request", {
    method: opts?.method || "GET",
    path,
    url: safeUrl,
    bodySize: typeof opts?.body === "string" ? opts.body.length : undefined,
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      ...opts,
      headers,
      signal: controller.signal,
    })

    const text = await res.text().catch(() => "")

    if (!res.ok) {
      log.error("velocity — API error", {
        method: opts?.method || "GET",
        path,
        url: safeUrl,
        status: res.status,
        authMode: AUTH_MODE,
        response: text,
        bodyPreview: typeof opts?.body === "string" ? JSON.parse(opts.body) : undefined,
      })
      throw new Error(`Velocity ${opts?.method || "GET"} ${path} → ${res.status}: ${text}`)
    }

    // Log successful response (truncate large bodies)
    log.info("velocity — response", {
      method: opts?.method || "GET",
      path,
      status: res.status,
      responseSize: text.length,
    })

    if (!text) {
      throw new Error(`Velocity ${opts?.method || "GET"} ${path} → empty response body`)
    }

    let parsed: T
    try {
      parsed = JSON.parse(text) as T
    } catch {
      throw new Error(`Velocity ${opts?.method || "GET"} ${path} → invalid JSON: ${text.slice(0, 200)}`)
    }

    return parsed
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Velocity ${opts?.method || "GET"} ${path} → timeout after ${FETCH_TIMEOUT_MS}ms`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
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
  redirectUrl?: string
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
  if (!VELOCITY_TICKET_ITEM_CODE || !VELOCITY_TICKET_ITEM_CODE.trim()) {
    throw new Error("Velocity createSalesOrder — VELOCITY_TICKET_ITEM_CODE not set")
  }
  const missing = validateRequiredFields(
    { currency: payload.currency, amount: payload.amount },
    "createVelocitySalesOrder",
  )
  if (missing.length > 0) {
    throw new Error(`Velocity createSalesOrder — missing required fields: ${missing.join(", ")}`)
  }

  const body: Record<string, unknown> = {
    currencyCodeString: payload.currency,
    orderDate: payload.orderDate || new Date().toISOString().split("T")[0],
    dueDate: payload.dueDate || payload.orderDate || new Date().toISOString().split("T")[0],
    notes: payload.notes || "TicketPulse order",
    authorized: true,
    items: [
      {
        itemCode: VELOCITY_TICKET_ITEM_CODE!,
        qty: 1,
        unitPrice: payload.amount,
        amount: payload.amount,
      },
    ],
    charges: [{ amount: 0 }],
  }
  // Send customerIdString only if we have a valid UUID. Velocity uses a default
  // customer when the field is omitted.
  if (isValidUUID(payload.customerId)) {
    body.customerIdString = payload.customerId
  }

  log.info("velocity — sales order payload", {
    amount: payload.amount,
    currency: payload.currency,
    itemCode: VELOCITY_TICKET_ITEM_CODE,
    hasCustomerId: !!payload.customerId,
    notes: payload.notes,
  })

  const result = await velocityFetch<Record<string, unknown>>("/sales-orders", {
    method: "POST",
    body: JSON.stringify(sanitizePayload(body)),
  })

  // Defensively extract trace — Velocity may use different field names
  const trace = (result.trace as string) || (result.salesOrderTrace as string) || (result.id as string)
  const workflowId = (result.workflowId as string) || (result.workflowId as string)
  const status = (result.status as string) || ""

  if (!trace) {
    log.error("velocity — sales order response missing trace field", { responseKeys: Object.keys(result) })
    throw new Error(`Velocity createSalesOrder — response missing trace field. Keys: ${Object.keys(result).join(",")}`)
  }

  return { trace, workflowId: workflowId || trace, status }
}

export async function initiateVelocityTransaction(payload: {
  amount: number
  processor: "ECOCASH" | "VMC"
  debitPhone: string
  debitCurrency: string
  authType: "REMOTE" | "WEB"
  salesOrderTrace: string
  returnUrl?: string
  customerEmail?: string
  idempotencyKey?: string
}): Promise<VelocityTransaction> {
  if (!MERCHANT_PHONE || !MERCHANT_ACCOUNT) {
    throw new Error("VELOCITY_MERCHANT_PHONE / VELOCITY_MERCHANT_ACCOUNT not set")
  }

  // Pre-validate all required fields
  const required: Record<string, unknown> = {
    amount: payload.amount,
    processor: payload.processor,
    debitPhone: payload.debitPhone,
    debitCurrency: payload.debitCurrency,
    authType: payload.authType,
    salesOrderTrace: payload.salesOrderTrace,
  }
  if (payload.authType === "WEB") {
    required.returnUrl = payload.returnUrl
    required.customerEmail = payload.customerEmail
  }
  const missing = validateRequiredFields(required, "initiateVelocityTransaction")
  if (missing.length > 0) {
    throw new Error(
      `Velocity initiateTransaction — missing/invalid required fields: ${missing.join(", ")}`,
    )
  }

  // Use idempotencyKey as the unique debitRef so Velocity can detect duplicates.
  // Falls back to the env-configured default.
  const transactionRef = payload.idempotencyKey || DEBIT_REF

  const body: Record<string, unknown> = {
    amount: payload.amount,
    paymentProcessorLabel: payload.processor,
    debitRegion: DEBIT_REGION,
    debitCurrency: payload.debitCurrency,
    debitRef: transactionRef,
    debitPhone: payload.debitPhone,
    creditPhone: MERCHANT_PHONE,
    creditRegion: "ZW",
    creditAccount: MERCHANT_ACCOUNT,
    type: "REQUEST",
    authType: payload.authType,
    salesOrderTrace: payload.salesOrderTrace,
  }

  if (payload.authType === "WEB" && payload.returnUrl) {
    body.callbackUrl = payload.returnUrl
    body.returnUrl = payload.returnUrl
  }

  if (payload.authType === "WEB" && payload.customerEmail) {
    body.customerEmail = payload.customerEmail
  }

  log.info("velocity — transaction payload", {
    processor: payload.processor,
    authType: payload.authType,
    amount: payload.amount,
    currency: payload.debitCurrency,
    hasDebitPhone: !!payload.debitPhone,
    hasReturnUrl: !!payload.returnUrl,
    hasCustomerEmail: !!payload.customerEmail,
    hasSalesOrderTrace: !!payload.salesOrderTrace,
    hasIdempotencyKey: !!payload.idempotencyKey,
    maskedMerchantPhone: MERCHANT_PHONE ? maskSecret(MERCHANT_PHONE) : "MISSING",
    maskedMerchantAccount: MERCHANT_ACCOUNT ? maskSecret(MERCHANT_ACCOUNT) : "MISSING",
  })

  const result = await velocityFetch<Record<string, unknown>>("/transactions", {
    method: "POST",
    body: JSON.stringify(sanitizePayload(body)),
  })

  // Defensively extract transaction trace
  const trace = (result.trace as string) || (result.transactionTrace as string) || (result.reference as string)
  const paymentStatus = (result.paymentStatus as string) || result.status as string || ""
  const pollStatus = (result.pollStatus as "PENDING" | "SUCCESS" | "FAILED") || "PENDING"
  const redirectUrl = result.redirectUrl as string | undefined

  if (!trace) {
    log.error("velocity — transaction response missing trace", { responseKeys: Object.keys(result) })
    throw new Error(`Velocity initiateTransaction — response missing trace. Keys: ${Object.keys(result).join(",")}`)
  }

  return { trace, paymentStatus, pollStatus, redirectUrl }
}

export async function pollVelocityTransaction(trace: string): Promise<VelocityPollResult> {
  const result = await velocityFetch<Record<string, unknown>>(`/transactions/poll/${encodeURIComponent(trace)}`, {
    method: "PUT",
  })
  return {
    paymentStatus: (result.paymentStatus as string) || "",
    pollStatus: (result.pollStatus as "PENDING" | "SUCCESS" | "FAILED") || "PENDING",
  }
}

export async function completeVelocitySalesOrder(trace: string): Promise<{ status: string }> {
  const result = await velocityFetch<Record<string, unknown>>(`/sales-orders/update-workflow/${encodeURIComponent(trace)}`, {
    method: "PUT",
  })
  return { status: (result.status as string) || "" }
}

export function velocityUrls(orderId: string, origin: string) {
  const base = origin.replace(/\/$/, "")
  return {
    returnUrl: `${base}/api/checkout/velocity/return/${orderId}`,
    webhookUrl: `${base}/api/checkout/velocity/webhook`,
  }
}
