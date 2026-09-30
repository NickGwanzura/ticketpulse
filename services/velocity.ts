import "server-only"
import { VelocityApiError } from "@/lib/velocity/api-error"
import { log } from "@/lib/logger"
import { alertPaymentAnomaly } from "@/lib/payment-alerts"
import type {
  CreateSalesOrderPayload,
  CreateSalesOrderResponse,
  InitiateTransactionPayload,
  InitiateTransactionResponse,
  PollTransactionResponse,
  FinalizeWorkflowResponse,
  LookupCustomerResponse,
  VelocityConfig,
  NormalizedPollResponse,
  VelocityPollReference,
  VelocitySalesOrderLookup,
  VelocityTransactionRecord,
} from "@/types/velocity"

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000
function safeVelocityPath(path: string): string {
  return path
    .split("/")
    .map((segment) => segment === "" || /^[a-z-]+$/i.test(segment) ? segment : "[redacted]")
    .join("/")
}

function responseShape(value: unknown): { type: string; keys?: string[] } {
  if (Array.isArray(value)) return { type: "array" }
  if (value === null) return { type: "null" }
  if (typeof value === "object") {
    return { type: "object", keys: Object.keys(value).slice(0, 20) }
  }
  return { type: typeof value }
}

function parsedErrorFields(rawBody: string | null): string[] {
  if (!rawBody) return []
  try {
    const value: unknown = JSON.parse(rawBody)
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? Object.keys(value).slice(0, 20)
      : []
  } catch {
    return []
  }
}

function safeStatus(value: unknown): string {
  return typeof value === "string" && /^[a-z_-]{1,32}$/i.test(value)
    ? value
    : "unrecognized"
}

function safeProviderErrorMessage(message: string, httpStatus: number): string {
  const normalized = message.toLowerCase()
  if (/max(?:imum)? poll attempts reached/.test(normalized)) return "Velocity max poll attempts reached"
  if (/not fully paid|outstanding/.test(normalized)) return "Velocity sales order is not fully paid"
  if (/unauthori[sz]ed|authentication|invalid api key/.test(normalized)) return "Velocity authorization failed"
  if (/not found/.test(normalized)) return "Velocity resource not found"
  if (/invalid|validation/.test(normalized)) return "Velocity rejected the request as invalid"
  return `Velocity API returned status ${httpStatus}`
}

function getRequestTimeoutMs(): number {
  const configured = Number(process.env.VELOCITY_REQUEST_TIMEOUT_MS)
  return Number.isFinite(configured) && configured >= 1_000 && configured <= 60_000
    ? configured
    : DEFAULT_REQUEST_TIMEOUT_MS
}

async function velocityFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), getRequestTimeoutMs())
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function getConfig(): VelocityConfig {
  const apiKey = process.env.VELOCITY_API_KEY
  const baseUrl = process.env.VELOCITY_BASE_URL ?? "https://api.velocityafrica.net"
  const itemCode = process.env.VELOCITY_ITEM_CODE ?? "tp001"
  const merchantPhone = process.env.VELOCITY_MERCHANT_PHONE

  if (!apiKey) {
    throw new Error("VELOCITY_API_KEY environment variable is not set")
  }

  return { apiKey, baseUrl, itemCode, merchantPhone: merchantPhone ?? "" }
}

let _cachedDefaultCustomerId: string | null = null
let _cachedCompanyId: string | null = null

async function resolveDefaultCustomer(): Promise<{ id: string; companyId: string }> {
  if (_cachedDefaultCustomerId && _cachedCompanyId) {
    return { id: _cachedDefaultCustomerId, companyId: _cachedCompanyId }
  }

  const config = getConfig()
  // Per Velocity docs: calling /customers without filters returns the default customer
  const response = await velocityFetch(`${config.baseUrl}/customers`, {
    headers: { "x-api-key": config.apiKey },
    next: { revalidate: 3600 },
  })

  if (!response.ok) throw new Error(`Velocity default customer lookup failed: ${response.status}`)

  const data = (await response.json()) as LookupCustomerResponse
  const defaultCustomer = data.content?.[0]

  if (!defaultCustomer?.id) {
    throw new Error("Velocity default customer not found")
  }

  _cachedDefaultCustomerId = defaultCustomer.id
  _cachedCompanyId = defaultCustomer.companyIdString as string
  return { id: _cachedDefaultCustomerId, companyId: _cachedCompanyId }
}

export async function getDefaultCustomerId(): Promise<string> {
  const { id } = await resolveDefaultCustomer()
  return id
}

async function velocityRequest<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
  } = {},
): Promise<T> {
  const config = getConfig()
  const url = `${config.baseUrl}${path}`
  const method = options.method ?? "POST"

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": config.apiKey,
  }

  const requestInit: RequestInit = {
    method,
    headers,
    next: { revalidate: 0 },
  }

  if (options.body !== undefined) {
    requestInit.body = JSON.stringify(options.body)
  }

  log.info(`velocity request`, {
    method,
    path: safeVelocityPath(path),
  })

  const start = Date.now()

  try {
    const response = await velocityFetch(url, requestInit)
    const elapsed = Date.now() - start

    if (!response.ok) {
      let errorBody: string | null = null
      try {
        errorBody = await response.text()
      } catch {}
      log.error(`velocity request failed`, {
        status: response.status,
        path: safeVelocityPath(path),
        elapsed,
        requestFields: options.body && typeof options.body === "object"
          ? Object.keys(options.body).slice(0, 20)
          : undefined,
        responseFields: parsedErrorFields(errorBody),
      })

      let errorMessage: string
      let parsedErrorBody: Record<string, unknown> | null = null
      if (errorBody) {
        try {
          parsedErrorBody = JSON.parse(errorBody)
          const parsed = parsedErrorBody!
          const details = Array.isArray(parsed.errors) && parsed.errors.length
            ? (parsed.errors as unknown[]).join("; ")
            : (parsed.message as string | undefined) ?? errorBody
          errorMessage = `Velocity API error: ${safeProviderErrorMessage(details, response.status)}`
        } catch {
          parsedErrorBody = null
          errorMessage = `Velocity API returned status ${response.status}`
        }
      } else {
        errorMessage = `Velocity API returned status ${response.status}`
      }

      // Alert on high-severity API errors (5xx server errors, auth failures)
      if (response.status >= 500 || response.status === 401 || response.status === 403) {
        alertPaymentAnomaly({
          type: "VELOCITY_API_UNEXPECTED_FORMAT",
          severity: response.status >= 500 ? "high" : "critical",
          title: `Velocity API error (${response.status})`,
          detail: `${method} ${safeVelocityPath(path)} returned HTTP ${response.status}`,
          context: {
            path: safeVelocityPath(path),
            method,
            httpStatus: response.status,
            elapsed,
            responseFields: parsedErrorBody ? Object.keys(parsedErrorBody).slice(0, 20) : [],
          },
        }).catch(() => {})
      }

      throw new VelocityApiError(errorMessage, response.status, path)
    }

    const responseText = await response.text()
    let data: T
    try {
      data = JSON.parse(responseText) as T
    } catch {
      throw new VelocityApiError("Velocity API returned a non-JSON response", response.status, path)
    }

    log.info(`velocity response`, {
      path: safeVelocityPath(path),
      elapsed,
      ...responseShape(data),
    })

    return data
  } catch (err) {
    // Re-throw known API errors cleanly (already prefixed with "Velocity API")
    if (err instanceof Error && err.message.startsWith("Velocity API")) {
      throw err
    }

    // Genuine network errors (fetch threw, DNS failure, timeout, etc.)
    log.error(`velocity network error`, {
      path: safeVelocityPath(path),
      errorType: err instanceof Error ? err.name : "UnknownError",
    })

    // Alert on network errors to Velocity API
    alertPaymentAnomaly({
      type: "VELOCITY_NETWORK_ERROR",
      severity: "high",
      title: "Network error communicating with Velocity",
      detail: `${method} ${safeVelocityPath(path)} failed before receiving a response`,
      context: { path: safeVelocityPath(path), method },
    }).catch(() => {})

    throw new Error("Network error communicating with Velocity Africa")
  }
}

export async function createSalesOrder(
  payload: CreateSalesOrderPayload,
): Promise<CreateSalesOrderResponse> {
  return velocityRequest<CreateSalesOrderResponse>("/sales-orders", {
    method: "POST",
    body: payload,
  })
}

export async function initiateTransaction(
  payload: InitiateTransactionPayload,
): Promise<InitiateTransactionResponse> {
  return velocityRequest<InitiateTransactionResponse>("/transactions", {
    method: "POST",
    body: payload,
  })
}

function normaliseTransactionPhone(phone: string | null | undefined): string {
  return String(phone ?? "").replace(/\D/g, "").replace(/^0/, "263")
}

function transactionAmount(transaction: VelocityTransactionRecord): number | null {
  const amount = transaction.orderAmount ?? transaction.amount ?? transaction.totalAmount
  const parsed = Number(amount)
  return Number.isFinite(parsed) ? parsed : null
}

function normaliseProcessorLabel(value: string | null | undefined): string {
  const label = String(value ?? "").toUpperCase().replace(/[^A-Z]/g, "")
  if (label.includes("VISA") || label.includes("MASTERCARD") || label === "VMC") return "VMC"
  if (label.includes("ECOCASH")) return "ECOCASH"
  return label
}

const TRANSACTION_LIST_CACHE_MS = 30_000
let transactionListCache: {
  expiresAt: number
  promise: Promise<VelocityTransactionRecord[]>
} | null = null

export function isVelocityTransactionSuccessful(transaction: VelocityTransactionRecord): boolean {
  return String(transaction.pollStatus ?? "").toUpperCase() === "SUCCESS" &&
    String(transaction.paymentStatus ?? "").toUpperCase() === "SUCCESS"
}

function transactionOutcomeRank(transaction: VelocityTransactionRecord): number {
  if (isVelocityTransactionSuccessful(transaction)) return 3
  const pollStatus = String(transaction.pollStatus ?? "").toUpperCase()
  const paymentStatus = String(transaction.paymentStatus ?? "").toUpperCase()
  if (pollStatus === "PENDING" || paymentStatus === "PENDING") return 2
  return 1
}

/**
 * Pick the provider transaction belonging to one sales order from the
 * read-only transaction list. This is deliberately pure so matching stays
 * testable and never guesses across different orders or amounts.
 */
export function selectVelocityTransaction(
  transactions: VelocityTransactionRecord[],
  options: {
    salesOrderId: string
    amount?: number | string | null
    paymentProcessor?: string | null
    debitPhone?: string | null
    debitRef?: string | null
  },
): VelocityTransactionRecord | null {
  const expectedAmount = options.amount == null ? null : Number(options.amount)
  const expectedPhone = normaliseTransactionPhone(options.debitPhone)
  const expectedProcessor = normaliseProcessorLabel(options.paymentProcessor)
  const candidates = transactions.filter((transaction) => {
    if (transaction.salesOrderId !== options.salesOrderId) return false
    const amount = transactionAmount(transaction)
    if (expectedAmount != null && (!Number.isFinite(amount) || amount !== expectedAmount)) return false
    if (expectedProcessor && normaliseProcessorLabel(transaction.paymentProcessorLabel) !== expectedProcessor) return false
    if (expectedPhone && normaliseTransactionPhone(transaction.debitPhone) !== expectedPhone) return false
    // Velocity replaces the client debitRef with its own EcoCash payment
    // reference (for example MP...). The sales-order ID is the authoritative
    // correlation key, so never reject an exact sales-order match because the
    // provider-generated debitRef differs.
    return Boolean(transaction.trace)
  })

  candidates.sort((a, b) => {
    const outcomeDifference = transactionOutcomeRank(b) - transactionOutcomeRank(a)
    if (outcomeDifference !== 0) return outcomeDifference
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0
    return bTime - aTime
  })
  return candidates[0] ?? null
}

/**
 * Recover a transaction reference after an initiation request timed out.
 * Velocity exposes the accepted transaction through its read-only list even
 * when the original POST response never reached TicketPulse.
 */
export async function findVelocityTransaction(options: {
  salesOrderId: string
  amount?: number | string | null
  paymentProcessor?: string | null
  debitPhone?: string | null
  debitRef?: string | null
}): Promise<VelocityTransactionRecord | null> {
  const now = Date.now()
  if (!transactionListCache || transactionListCache.expiresAt <= now) {
    const promise = velocityRequest<unknown>("/transactions", { method: "GET" })
      .then((response) => Array.isArray(response)
        ? response as VelocityTransactionRecord[]
        : (response && typeof response === "object" && Array.isArray((response as { content?: unknown }).content)
          ? (response as { content: VelocityTransactionRecord[] }).content
          : []))
      .catch((error) => {
        transactionListCache = null
        throw error
      })
    transactionListCache = { expiresAt: now + TRANSACTION_LIST_CACHE_MS, promise }
  }
  const transactions = await transactionListCache.promise
  return selectVelocityTransaction(transactions, options)
}

/**
 * Read a sales order without advancing its workflow. This must be checked
 * before update-workflow because Velocity's update endpoint is not
 * idempotent: repeated calls create duplicate payment applications.
 */
export async function getSalesOrderById(salesOrderId: string): Promise<VelocitySalesOrderLookup> {
  return velocityRequest<VelocitySalesOrderLookup>(
    `/sales-orders/${encodeURIComponent(salesOrderId)}`,
    { method: "GET" },
  )
}

export async function pollTransaction(
  transactionTrace: string,
  _reference: VelocityPollReference = {},
): Promise<PollTransactionResponse> {
  const config = getConfig()
  // The current Velocity poll contract uses the transaction trace in the
  // route and defines no request body. Keep the optional reference parameter
  // for callers using the older integration signature.
  const path = `/transactions/poll/${encodeURIComponent(transactionTrace)}`
  const url = `${config.baseUrl}${path}`

  const headers: Record<string, string> = {
    "x-api-key": config.apiKey,
  }

  log.info("velocity request", {
    method: "PUT",
    path: safeVelocityPath(path),
  })
  const start = Date.now()

  try {
    const response = await velocityFetch(url, {
      method: "PUT",
      headers,
      next: { revalidate: 0 },
    })
    const elapsed = Date.now() - start

    const responseText = await response.text()
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(responseText) as Record<string, unknown>
    } catch {
      parsed = {}
    }

    const providerErrors = Array.isArray(parsed.errors)
      ? parsed.errors.filter((entry): entry is string => typeof entry === "string")
      : []
    const providerErrorText = !response.ok
      ? [
          typeof parsed.message === "string" ? parsed.message : `Velocity returned HTTP ${response.status}`,
          ...providerErrors,
        ].filter(Boolean).join(": ")
      : null
    const providerError = providerErrorText
      ? safeProviderErrorMessage(providerErrorText, response.status)
      : null

    // Ensure the response has a body property at the top level. A provider
    // transport/API error is not a payment decision: keep both statuses
    // UNKNOWN so reconciliation can distinguish it from a real FAILED poll.
    const responseBody =
      (parsed.body as PollTransactionResponse["body"]) ?? {
        id: "",
        trace: transactionTrace,
        amount: 0,
        paymentStatus: "UNKNOWN",
        pollStatus: "UNKNOWN",
      }

    const data: PollTransactionResponse = {
      state: typeof parsed.state === "string" ? parsed.state : (response.ok ? "unknown" : "provider_error"),
      status: typeof parsed.status === "string" ? parsed.status : (response.ok ? "unknown" : "error"),
      body: responseBody,
      workflowId: (parsed.workflowId as string) ?? "",
      httpStatus: response.status,
      errorMessage: providerError,
    }

    log.info("velocity response", {
      path: safeVelocityPath(path),
      httpStatus: response.status,
      elapsed,
      state: safeStatus(data.state),
      status: safeStatus(data.status),
      paymentStatus: safeStatus(data.body.paymentStatus),
      pollStatus: safeStatus(data.body.pollStatus),
    })

    return data
  } catch (err) {
    const elapsed = Date.now() - start
    log.error("pollTransaction - network error", {
      path: safeVelocityPath(path),
      elapsed,
      errorType: err instanceof Error ? err.name : "UnknownError",
    })

    return {
      state: "network_error",
      status: "error",
      body: {
        id: "",
        trace: transactionTrace,
        amount: 0,
        paymentStatus: "UNKNOWN",
        pollStatus: "UNKNOWN",
      },
      workflowId: "",
      httpStatus: null,
      errorMessage: "Network error communicating with Velocity",
    } as PollTransactionResponse
  }
}

/**
 * Extract the hosted checkout session identifier from a Velocity redirect URL.
 * VMC uses URLs shaped like /payment/{sessionId}; the session is retained as
 * a reconciliation reference, but transactionTrace remains the poll key.
 */
export function extractHostedSessionId(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("https://")) return null

  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean)
    const paymentIndex = parts.findIndex((part) => part.toLowerCase() === "payment")
    const sessionId = paymentIndex >= 0 ? parts[paymentIndex + 1] : undefined
    return sessionId ? decodeURIComponent(sessionId) : null
  } catch {
    return null
  }
}

export async function finalizeWorkflow(
  salesOrderTrace: string,
): Promise<FinalizeWorkflowResponse> {
  try {
    return await velocityRequest<FinalizeWorkflowResponse>(
      `/sales-orders/update-workflow/${salesOrderTrace}`,
      { method: "PUT" },
    )
  } catch (err) {
    // "Sales order is not fully paid" is a timing issue: Velocity's transaction
    // ledger and sales-order system are eventually consistent. The poll confirms
    // the payment, but Velocity's internal reconciliation job may not have
    // applied it to the SO yet. Wait 3 s and retry once before surfacing the
    // error — that window is almost always enough for the SO to catch up.
    const msg = err instanceof Error ? err.message.toLowerCase() : ""
    if (msg.includes("not fully paid") || msg.includes("outstanding")) {
      log.warn("finalizeWorkflow - sales order not yet reconciled, retrying in 3 s", {
        salesOrderTrace,
        reason: "sales_order_not_yet_reconciled",
      })
      await new Promise((r) => setTimeout(r, 3000))
      return velocityRequest<FinalizeWorkflowResponse>(
        `/sales-orders/update-workflow/${salesOrderTrace}`,
        { method: "PUT" },
      )
    }
    throw err
  }
}

export function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\(\)]/g, "")
  return cleaned.startsWith("+") && cleaned.length >= 10 && cleaned.length <= 15
}

export function getAuthType(processor: string): "REMOTE" | "WEB" {
  return processor === "ECOCASH" ? "REMOTE" : "WEB"
}

export function getProcessorLabel(paymentMethod: string): string {
  const map: Record<string, string> = {
    "velocity-ecocash": "ECOCASH",
    "velocity-card": "VMC",
  }
  return map[paymentMethod] ?? ""
}

/**
 * Normalize the full Velocity poll response into a local payment status.
 *
 * Priority order:
 *   1. body.pollStatus === "SUCCESS"   => PAID
 *   Initiation paymentStatus SUCCESS is not proof of payment. Only poll success
 *   or a separately verified fully paid sales order confirms settlement.
 *   3. body.pollStatus === "FAILED"    => FAILED
 *   4. body.paymentStatus === "FAILED" => FAILED
 *   5. body.pollStatus === "PENDING"   => PENDING
 *   6. anything else                   => UNKNOWN (require admin recheck)
 *   7. null/undefined response         => UNKNOWN
 *
 * Never throws.
 */
export function normalizeVelocityPollResponse(
  response: PollTransactionResponse | null | undefined,
): NormalizedPollResponse {
  if (!response) {
    return {
      localStatus: "UNKNOWN",
      velocityPaymentStatus: null,
      velocityPollStatus: null,
      velocityWorkflowStatus: null,
      rawResponse: null,
    }
  }

  const pollStatus = response.body?.pollStatus
  const paymentStatus = response.body?.paymentStatus
  const workflowStatus = response.status

  let localStatus: NormalizedPollResponse["localStatus"]

  if (pollStatus === "SUCCESS") {
    localStatus = "PAID"
  } else if (pollStatus === "FAILED") {
    localStatus = "FAILED"
  } else if (paymentStatus === "FAILED") {
    localStatus = "FAILED"
  } else if (pollStatus === "PENDING") {
    localStatus = "PENDING"
  } else {
    localStatus = "UNKNOWN"
  }

  return {
    localStatus,
    velocityPaymentStatus: paymentStatus ?? null,
    velocityPollStatus: pollStatus ?? null,
    velocityWorkflowStatus: workflowStatus ?? null,
    rawResponse: response,
  }
}

export { getConfig }
