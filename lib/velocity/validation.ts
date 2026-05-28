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
  if (!validatePhone(params.phone)) {
    return "Invalid phone number format. Must start with +"
  }
  if (!validateCurrency(params.currency)) {
    return `Invalid currency: ${params.currency}`
  }
  return null
}
