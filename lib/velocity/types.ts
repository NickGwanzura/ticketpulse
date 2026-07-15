import "server-only"

export interface VelocitySmsRequest {
  recipient: string
  message: string
}

export interface VelocitySmsResponse {
  status?: number
  result?: string
  message?: string
  [key: string]: unknown
}

export interface SmsSendResult {
  ok: boolean
  messageReference: string
  recipient: string
  providerStatus: number
  providerResult: string
  durationMs: number
}

export interface SmsBatchResult {
  success: boolean
  template: string
  messageReference: string
  providerResponse: Record<string, unknown>
  results: SmsSendResult[]
}

export class SmsError extends Error {
  constructor(
    message: string,
    public readonly code: "VALIDATION" | "AUTH" | "RATE_LIMIT" | "PROVIDER" | "TIMEOUT" | "NETWORK" | "UNKNOWN",
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message)
    this.name = "SmsError"
  }
}
