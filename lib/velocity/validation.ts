import type { VelocityCurrency, VelocityPaymentProcessor } from "@/types/velocity"

const VALID_CURRENCIES: VelocityCurrency[] = ["USD", "ZWG"]
const VALID_PROCESSORS: VelocityPaymentProcessor[] = ["ECOCASH", "VMC", "CASH"]

export function validateCurrency(currency: string): currency is VelocityCurrency {
  return VALID_CURRENCIES.includes(currency as VelocityCurrency)
}

export function validatePaymentProcessor(processor: string): processor is VelocityPaymentProcessor {
  return VALID_PROCESSORS.includes(processor as VelocityPaymentProcessor)
}

export function validateAmount(amount: number): boolean {
  return typeof amount === "number" && amount > 0 && Number.isFinite(amount)
}

export function isValidUUID(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)
}

export function validatePhone(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false
  const cleaned = phone.replace(/[\s\-\(\)]/g, "")
  return cleaned.startsWith("+") && /^\+[1-9]\d{6,14}$/.test(cleaned)
}

/**
 * Auto-format a phone number into E.164 international format.
 * - If the number starts with "0" (Zimbabwe local format), prepends +263
 * - Strips whitespace, dashes, and parentheses before formatting
 * - Returns the original cleaned number if no transformation applies
 */
export function formatPhone(phone: string): string {
  if (!phone) return phone
  // Strip whitespace, dashes, parens, and stray quote/apostrophe characters
  // (apostrophes appear when numbers are copy-pasted from spreadsheets)
  let cleaned = phone.replace(/[\s\-\(\)'"`]/g, "")
  // Zimbabwe: 0771234567 → +263771234567, 0712345678 → +263712345678
  if (cleaned.startsWith("0") && cleaned.length >= 9) {
    cleaned = "+263" + cleaned.slice(1)
  }
  // Already has + but missing country code prefix — let through as-is
  return cleaned
}

export function validateSalesOrderPayload(params: {
  currency: string
  quantity: number
  unitPrice: number
  totalAmount: number
}): string | null {
  if (!validateCurrency(params.currency)) {
    return `Invalid currency: ${params.currency}. Must be USD or ZWG`
  }
  if (!Number.isInteger(params.quantity) || params.quantity <= 0) {
    return "Quantity must be a positive integer"
  }
  if (!validateAmount(params.unitPrice)) {
    return "Unit price must be a positive number"
  }
  if (!validateAmount(params.totalAmount)) {
    return "Total amount must be a positive number"
  }
  if (Math.abs(params.totalAmount - params.quantity * params.unitPrice) > 0.01) {
    return "Total amount must equal quantity × unit price"
  }
  return null
}

/**
 * Validate the transaction payload before sending to Velocity.
 *
 * For card (VMC) payments, phone number validation is relaxed because
 * the debit phone is less critical for hosted checkout — Velocity's
 * card flow doesn't send a USSD prompt to the phone number.
 */
export function validateTransactionPayload(params: {
  amount: number
  processor: string
  phone: string
  currency: string
}): string | null {
  if (!validateAmount(params.amount)) {
    return "Amount must be a positive number"
  }
  if (!validatePaymentProcessor(params.processor)) {
    return `Invalid payment processor: ${params.processor}`
  }
  // For card payments (VMC), the phone number is sent to Velocity but
  // not used for a USSD prompt — relax validation so that edge cases
  // (e.g. non-Zimbabwe numbers, slightly unusual formatting) don't block
  // the transaction. For EcoCash the phone MUST be valid since
  // Velocity uses it to send the payment prompt.
  if (params.processor !== "VMC" && !validatePhone(params.phone)) {
    return "Invalid phone number format. Must start with + and contain 7-14 digits after the country code (e.g. +263771234567)"
  }
  if (!validateCurrency(params.currency)) {
    return `Invalid currency: ${params.currency}`
  }
  return null
}

// ─── SMS Validation ──────────────────────────────────────────────────────

const ZIM_CODE = "263"

/**
 * Normalise a Zimbabwe phone number into MSISDN format ("26377xxxxxxx").
 *
 * Accepts: 077xxxxxxx, +26377xxxxxxx, 26377xxxxxxx
 *
 * @throws {Error} for empty, too-short, or non-Zimbabwean numbers.
 */
export function normaliseMsisdn(raw: string): string {
  const cleaned = raw.replace(/[\s\-\(\)]+/g, "").trim()

  if (!cleaned) {
    throw new Error("Phone number is empty")
  }

  let digits = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned

  if (!digits.startsWith("263") && !digits.startsWith("0")) {
    throw new Error(`Not a Zimbabwe number: "${raw}"`)
  }

  if (digits.startsWith("0")) {
    digits = digits.slice(1)
  }

  if (!digits.startsWith(ZIM_CODE)) {
    digits = `${ZIM_CODE}${digits}`
  }

  if (digits.length < 11) {
    throw new Error(`MSISDN too short after normalisation: "${digits}"`)
  }

  if (!/^\d{11,}$/.test(digits)) {
    throw new Error(`MSISDN contains non-digit characters: "${digits}"`)
  }

  return digits
}

export function isValidMsisdn(raw: string): boolean {
  try {
    normaliseMsisdn(raw)
    return true
  } catch {
    return false
  }
}
