import "server-only"
import { log } from "@/lib/logger"
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
} from "@/types/velocity"

function getConfig(): VelocityConfig {
  const apiKey = process.env.VELOCITY_API_KEY
  const baseUrl = process.env.VELOCITY_BASE_URL ?? "https://api.velocityafrica.net"
  const itemCode = process.env.VELOCITY_ITEM_CODE ?? "tp002"
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
  const response = await fetch(`${config.baseUrl}/customers`, {
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
    const response = await fetch(url, requestInit)
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
      if (errorBody) {
        try {
          const parsed = JSON.parse(errorBody)
          const details = Array.isArray(parsed.errors) && parsed.errors.length
            ? parsed.errors.join("; ")
            : parsed.message ?? errorBody
          errorMessage = `Velocity API error: ${details}`
        } catch {
          errorMessage = `Velocity API error: ${errorBody}`
        }
      } else {
        errorMessage = `Velocity API returned status ${response.status}`
      }
      throw new Error(errorMessage)
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

export async function pollTransaction(
  transactionTrace: string,
): Promise<PollTransactionResponse> {
  const config = getConfig()
  const url = `${config.baseUrl}/transactions/poll/${transactionTrace}`

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": config.apiKey,
  }

  log.info("velocity request", { method: "PUT", path: `/transactions/poll/${transactionTrace}` })
  const start = Date.now()

  try {
    const response = await fetch(url, {
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

    // Ensure the response has a body property at the top level.
    // If the parsed JSON doesn't have "body" (e.g. error responses like
    // { message: "Transaction failed" }), construct a synthetic body.
    const responseBody =
      (parsed.body as PollTransactionResponse["body"]) ?? {
        id: "",
        trace: transactionTrace,
        amount: 0,
        paymentStatus: response.ok ? "UNKNOWN" : "FAILED",
        pollStatus: "UNKNOWN",
      }

    const data: PollTransactionResponse = {
      state: (parsed.state as string) ?? (response.ok ? "unknown" : "error"),
      status: (parsed.status as string) ?? (response.ok ? "unknown" : "error"),
      body: responseBody,
      workflowId: (parsed.workflowId as string) ?? "",
    }

    log.info("velocity response", {
      path: `/transactions/poll/${transactionTrace}`,
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
    } as PollTransactionResponse
  }
}

export async function finalizeWorkflow(
  salesOrderTrace: string,
): Promise<FinalizeWorkflowResponse> {
  return velocityRequest<FinalizeWorkflowResponse>(
    `/sales-orders/update-workflow/${salesOrderTrace}`,
    { method: "PUT" },
  )
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
 *   2. body.paymentStatus === "SUCCESS" => PAID  (gateway settlement confirmed;
 *        covers PENDING+SUCCESS and FAILED+SUCCESS when the poll workflow lags)
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
  } else if (paymentStatus === "SUCCESS") {
    // Gateway confirmed settlement — promote to PAID even when pollStatus is
    // still PENDING or FAILED (the async poll workflow can lag behind).
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
