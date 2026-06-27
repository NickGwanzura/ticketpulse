import "server-only"
import { randomUUID } from "crypto"
import { log } from "@/lib/logger"
import { SMS_TEMPLATE } from "@/lib/sms-templates"

const BASE_URL = "https://sms.velocityafrica.net/api/v1"

function getToken(): string {
  const token = process.env.VELOCITY_AFRICA_SMS_TOKEN
  if (!token) throw new Error("VELOCITY_AFRICA_SMS_TOKEN is not set")
  return token
}

/**
 * Format a phone number into an MSISDN for VelocityAfrica.
 * Strips non-digits and removes a leading 0 if present.
 *
 * @example formatMsisdn("+263 77 123 4567") // "263771234567"
 * @example formatMsisdn("0771234567")        // "771234567"
 */
export function formatMsisdn(phone: string): string {
  let digits = phone.replace(/\D/g, "")
  if (digits.startsWith("0")) digits = digits.slice(1)
  return digits
}

export type SendSmsResult = {
  status: number
  result: string
}

export async function sendSms(
  msisdn: string,
  templateId: number,
): Promise<SendSmsResult> {
  const token = getToken()

  const body = {
    batchReference: randomUUID(),
    smsList: [
      {
        reference: randomUUID(),
        templateId,
        msisdn,
      },
    ],
  }

  const res = await fetch(`${BASE_URL}/sms/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error")
    throw new Error(`VelocityAfrica SMS error (${res.status}): ${text}`)
  }

  return res.json() as Promise<SendSmsResult>
}

export async function sendTicketConfirmationSms(phone: string): Promise<SendSmsResult> {
  const tid = SMS_TEMPLATE.TICKET_CONFIRMATION()
  const msisdn = formatMsisdn(phone)
  log.info("sms — sending ticket confirmation", { msisdn, templateId: tid })
  return sendSms(msisdn, tid)
}

export async function sendEventReminderSms(phone: string): Promise<SendSmsResult> {
  const tid = SMS_TEMPLATE.EVENT_REMINDER()
  const msisdn = formatMsisdn(phone)
  log.info("sms — sending event reminder", { msisdn, templateId: tid })
  return sendSms(msisdn, tid)
}

export async function sendTicketTransferSms(phone: string): Promise<SendSmsResult> {
  const tid = SMS_TEMPLATE.TICKET_TRANSFER()
  const msisdn = formatMsisdn(phone)
  log.info("sms — sending ticket transfer notification", { msisdn, templateId: tid })
  return sendSms(msisdn, tid)
}

export async function sendTicketsResentSms(phone: string): Promise<SendSmsResult> {
  const tid = SMS_TEMPLATE.TICKETS_RESENT()
  const msisdn = formatMsisdn(phone)
  log.info("sms — sending tickets resent notification", { msisdn, templateId: tid })
  return sendSms(msisdn, tid)
}
