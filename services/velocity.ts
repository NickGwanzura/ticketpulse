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
} from "@/types/velocity"

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000

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
    path,
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
        path,
        elapsed,
        requestBody: options.body ? JSON.stringify(options.body).slice(0, 2000) : undefined,
        errorBody,
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
          errorMessage = `Velocity API error: ${details}`
        } catch {
          parsedErrorBody = { rawBody: errorBody.slice(0, 500) }
          errorMessage = `Velocity API error: ${errorBody}`
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
          detail: `${method} ${path} returned HTTP ${response.status}: ${errorMessage.slice(0, 300)}`,
          context: {
            path,
            method,
            httpStatus: response.status,
            elapsed,
            errorPreview: errorMessage.slice(0, 500),
            parsedErrorBody: parsedErrorBody ? Object.keys(parsedErrorBody).slice(0, 10) : null,
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
      throw new Error(`Velocity API returned non-JSON response: ${responseText.slice(0, 500)}`)
    }

    log.info(`velocity response`, {
      path,
      elapsed,
      body: JSON.stringify(data).slice(0, 2000),
    })

    return data
  } catch (err) {
    // Re-throw known API errors cleanly (already prefixed with "Velocity API")
    if (err instanceof Error && err.message.startsWith("Velocity API")) {
      throw err
    }

    // Genuine network errors (fetch threw, DNS failure, timeout, etc.)
    log.error(`velocity network error`, {
      path,
      error: err instanceof Error ? err.message : String(err),
    })

    // Alert on network errors to Velocity API
    alertPaymentAnomaly({
      type: "VELOCITY_NETWORK_ERROR",
      severity: "high",
      title: "Network error communicating with Velocity",
      detail: `${method} ${path} failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      context: { path, method },
    }).catch(() => {})

    throw new Error(`Network error communicating with Velocity Africa: ${err instanceof Error ? err.message : "Unknown error"}`)
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
  reference: VelocityPollReference = {},
): Promise<PollTransactionResponse> {
  const config = getConfig()
  // Velocity's route parameter is the workflow/transaction trace. The
  // provider-assigned transaction UUID belongs in the body only. Supplying
  // that UUID in the URL makes Velocity look for a workflow with the UUID and
  // returns HTTP 500 ("Workflow instance with that ID does not exist").
  const path = `/transactions/poll/${encodeURIComponent(transactionTrace)}`
  const url = `${config.baseUrl}${path}`
  const bodyReference = reference.transactionId ?? reference.transactionSessionId
  const requestBody: { id?: string; trace: string } = bodyReference ? {
    id: bodyReference,
    trace: transactionTrace,
  } : { trace: transactionTrace }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": config.apiKey,
  }

  log.info("velocity request", {
    method: "PUT",
    path,
    hasTransactionId: Boolean(reference.transactionId),
    hasSessionReference: Boolean(reference.transactionSessionId),
  })
  const start = Date.now()

  try {
    const response = await velocityFetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(requestBody),
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
    const providerError = !response.ok
      ? [
          typeof parsed.message === "string" ? parsed.message : `Velocity returned HTTP ${response.status}`,
          ...providerErrors,
        ].filter(Boolean).join(": ")
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
      path,
      httpStatus: response.status,
      elapsed,
      body: JSON.stringify(data).slice(0, 2000),
    })

    return data
  } catch (err) {
    const elapsed = Date.now() - start
    log.error("pollTransaction - network error", {
      transactionTrace,
      elapsed,
      error: err instanceof Error ? err.message : String(err),
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
      errorMessage: err instanceof Error ? err.message : String(err),
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
        error: err instanceof Error ? err.message : String(err),
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
