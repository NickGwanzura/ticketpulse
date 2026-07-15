/**
 * Backward-compatible SMS module.
 *
 * Re-exports the new Velocity Africa SMS service with the same public API
 * that existing callers expect. New code should import directly from:
 *   @/services/sms.service  (business logic wrappers)
 *   @/lib/velocity/sms       (core send function)
 *   @/lib/velocity/templates (template registry)
 */
export { sendSms } from "@/lib/velocity/sms"
export { resolveTemplateBody, SMS_TEMPLATES } from "@/lib/velocity/templates"
export type { SmsTemplateName } from "@/lib/velocity/templates"
export type { SmsBatchResult, SmsSendResult } from "@/lib/velocity/types"
export { SmsError } from "@/lib/velocity/types"

// ─── Convenience wrappers (preserve existing callers) ────────────────────
export { sendTicketConfirmationSms, sendEventReminderSms, sendTicketTransferSms, sendTicketsResentSms } from "@/services/sms.service"
