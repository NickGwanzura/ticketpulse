import "server-only"
import { sendSms } from "@/lib/velocity/sms"
import { log } from "@/lib/logger"

/**
 * Send ticket confirmation SMS after a successful purchase.
 */
export async function sendTicketConfirmationSms(phone: string) {
  log.info("sms.service — ticket confirmation", { phone })
  return sendSms("TICKET_CONFIRMATION", phone)
}

/**
 * Send event reminder SMS ~24 hours before the event.
 */
export async function sendEventReminderSms(phone: string) {
  log.info("sms.service — event reminder", { phone })
  return sendSms("EVENT_REMINDER_24H", phone)
}

/**
 * Send ticket transfer notification.
 */
export async function sendTicketTransferSms(phone: string) {
  log.info("sms.service — ticket transfer", { phone })
  return sendSms("TICKET_TRANSFER_RECEIVED", phone)
}

/**
 * Send "tickets resent" notification.
 */
export async function sendTicketsResentSms(phone: string) {
  log.info("sms.service — tickets resent", { phone })
  return sendSms("TICKETS_RESENT", phone)
}
