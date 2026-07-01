import "server-only"

export interface VelocitySmsRecipient {
  msisdn: string
  reference: string
  templateId: number
  variables: Record<string, string>
}

export interface VelocitySmsRequest {
  batchReference: string
  smsList: VelocitySmsRecipient[]
}

export interface VelocitySmsResponse {
  status: number
  result: string
  batchReference?: string
  messages?: Array<{
    reference: string
    status: number
    result: string
  }>
}

export interface SmsSendResult {
  ok: boolean
  batchReference: string
  messageReference: string
  recipient: string
  templateId: number
  providerStatus: number
  providerResult: string
  durationMs: number
}

export interface SmsBatchResult {
  success: boolean
  template: string
  templateId: number
  batchReference: string
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
