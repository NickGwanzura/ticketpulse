export type VelocityPaymentProcessor = "ECOCASH" | "VMC" | "CASH"
export type VelocityCurrency = "USD" | "ZWG"
export type VelocityAuthType = "REMOTE" | "WEB"
export type VelocityPollStatus = "SUCCESS" | "FAILED" | "PENDING" | "TIMEOUT" | "INITIATED_BUT_NO_REDIRECT" | "UNKNOWN"

export type LocalPaymentStatus = "PAID" | "FAILED" | "PENDING" | "UNKNOWN"

export type PaymentState = "PENDING" | "UNPAID" | "PARTIAL" | "PAID" | "FAILED" | "EXPIRED"

export interface VelocityConfig {
  apiKey: string
  baseUrl: string
  itemCode: string
  merchantPhone: string
}

export interface CreateSalesOrderPayload {
  currencyCodeString: VelocityCurrency
  customerIdString: string
  orderDate: string
  dueDate: string
  notes: string
  authorized: boolean
  items: SalesOrderItem[]
}

export interface SalesOrderItem {
  itemCode: string
  qty: number
  unitPrice: number
  amount: number
}

export interface VelocityOrderBody {
  id?: string
  paidAmount: number
  changeAmount: number
  outstandingAmount: number
  trace: string
  authorized: boolean
  name: string
  grandTotal: number
  status: string
}

export interface CreateSalesOrderResponse {
  state: string
  status: string
  body: VelocityOrderBody
  workflowId: string
  externalId: string | null
}

export interface InitiateTransactionPayload {
  amount: number
  paymentProcessorLabel: VelocityPaymentProcessor
  debitPhone: string
  debitRegion: string
  debitCurrency: VelocityCurrency
  debitRef: string
  creditPhone: string
  creditRegion: string
  creditAccount: string
  type: string
  authType: VelocityAuthType
  salesOrderId: string
  returnUrl?: string
  successUrl?: string
  cancelUrl?: string
}

export interface VelocityTransactionBody {
  id: string
  trace: string
  amount: number
  paymentStatus: string
  pollStatus: string
  redirectUrl?: string
  paymentUrl?: string
  checkoutUrl?: string
  gatewayUrl?: string
  authorizationUrl?: string
  url?: string
  [key: string]: unknown
}

export interface InitiateTransactionResponse {
  state: string
  status: string
  body: VelocityTransactionBody
  workflowId: string
}

export interface PollTransactionResponse {
  state: string
  status: string
  body: VelocityTransactionBody & { pollStatus: VelocityPollStatus }
  workflowId: string
}

export interface VelocityFinalizeSalesOrder {
  id: string
  paidAmount: number
  outstandingAmount: number
  status: string
  name: string
}

export interface VelocityFinalizeInvoice {
  id: string
  name: string
  status: string
}

export interface FinalizeWorkflowBody {
  salesOrder: VelocityFinalizeSalesOrder
  invoice: VelocityFinalizeInvoice
}

export interface FinalizeWorkflowResponse {
  state: string
  status: string
  body: FinalizeWorkflowBody
}

export interface VelocityCustomer {
  id: string
  name: string
  email: string
  phone: string
  [key: string]: unknown
}

export interface LookupCustomerResponse {
  content: VelocityCustomer[]
  totalPages?: number
  totalElements?: number
}

export interface VelocityErrorResponse {
  message: string
  code?: string
  details?: Record<string, unknown>
}

export interface NormalizedPollResponse {
  localStatus: LocalPaymentStatus
  velocityPaymentStatus: string | null
  velocityPollStatus: string | null
  velocityWorkflowStatus: string | null
  rawResponse: PollTransactionResponse | null
}

export interface VelocityOrderMetadata {
  salesOrderTrace: string
  transactionTrace: string | null
  outstandingAmount: number
  paymentProcessor: VelocityPaymentProcessor | null
  pollStatus: VelocityPollStatus | null
  paymentStatus?: string | null
  paymentRef: string | null
  invoiceRef: string | null
  initiatedAt: string | null
  finalizedAt: string | null
  failedAt?: string | null
  failureReason?: string | null
  velocityRawPollResponse?: Record<string, unknown> | null
  recheckedAt?: string | null
  recheckedBy?: string | null
}

export interface VelocityCheckoutResponse {
  orderId: string
  salesOrderTrace: string
  transactionTrace: string
  flow: "velocity-seamless" | "velocity-redirect"
  redirectUrl?: string
  amount: number
  currency: VelocityCurrency
}

export interface VelocityStatusResponse {
  orderId: string
  status: string
  paid: boolean
  pollStatus: VelocityPollStatus | null
  salesOrderTrace: string | null
  transactionTrace: string | null
  paymentProcessor: VelocityPaymentProcessor | null
  sentTo?: string
}

export const VELOCITY_PROCESSOR_LABELS: Record<string, VelocityPaymentProcessor> = {
  "velocity-ecocash": "ECOCASH",
  "velocity-card": "VMC",
}

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  PENDING: "Pending",
  UNPAID: "Unpaid",
  PARTIAL: "Partially Paid",
  PAID: "Paid",
  FAILED: "Failed",
  EXPIRED: "Expired",
}

export const PAYMENT_STATE_STYLES: Record<PaymentState, string> = {
  PENDING:                 "bg-amber-50 text-amber-700 ring-1 ring-amber-200/50",
  UNPAID:                  "bg-gray-100 text-gray-600 ring-1 ring-gray-200",
  PARTIAL:                 "bg-blue-50 text-blue-700 ring-1 ring-blue-200/50",
  PAID:                    "bg-emerald-50 text-emerald-700",
  FAILED:                  "bg-red-50 text-red-700 ring-1 ring-red-200/50",
  EXPIRED:                 "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
}
