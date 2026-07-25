"use client"

import { useActionState, useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Send, MessageSquare, Wallet } from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import {
  sendBulkSmsAction,
  sendTestSmsAction,
  getAttendeeSmsCount,
  getSmsBalanceForOrganizer,
  type SmsFormState,
} from "./actions"

const COST_PER_SMS_USD = 0.03

function inputCls(hasError?: boolean) {
  return [
    "w-full rounded-xl border bg-paper px-4 py-3 text-[14px] text-ink placeholder:text-ink-3",
    "focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-green-500 transition",
    hasError ? "border-red-400" : "border-line",
  ].join(" ")
}

export default function SmsPage() {
  const params = useParams<{ id: string }>()
  const eventId = params.id

  const [message, setMessage] = useState("")
  const [eventTitle, setEventTitle] = useState("your event")
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [balance, setBalance] = useState<number | null>(null)

  const [bulkState, bulkAction, bulkPending] = useActionState<SmsFormState, FormData>(
    sendBulkSmsAction.bind(null, eventId),
    { ok: false },
  )

  const [testState, testAction, testPending] = useActionState<
    { ok: boolean; error?: string } | undefined,
    FormData
  >(sendTestSmsAction.bind(null, eventId), undefined)

  useEffect(() => {
    getAttendeeSmsCount(eventId).then(setRecipientCount).catch(() => {})
    getSmsBalanceForOrganizer().then(setBalance).catch(() => {})
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const ev = data.find((e: { id: string }) => e.id === eventId)
          if (ev) setEventTitle(ev.title ?? "your event")
        }
      })
      .catch(() => {})
  }, [eventId])

  // Refresh balance after a send completes
  useEffect(() => {
    if (bulkState.ok) getSmsBalanceForOrganizer().then(setBalance).catch(() => {})
  }, [bulkState])

  const canSend = message.trim() && message.length <= 459 && !bulkPending && !testPending
  const charCount = message.length
  const segments = Math.max(1, Math.ceil(charCount / 153))
  const estimatedCost = recipientCount ? (recipientCount * segments * COST_PER_SMS_USD).toFixed(2) : null
  const insufficientBalance = balance !== null && recipientCount !== null && balance < recipientCount * segments

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title="SMS broadcast"
        actions={
          <Link
            href={`/organizer/events/${eventId}/edit`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} />
            Back to event
          </Link>
        }
      />

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-6">
        {/* Info card */}
        <div className="rounded-2xl border border-line bg-paper p-5 md:p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-green-50 p-2 shrink-0">
              <MessageSquare size={18} className="text-brand-600" />
            </div>
            <div className="space-y-1">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">SMS messaging</h2>
              <p className="text-[13px] text-ink-3 leading-relaxed">
                Send a text message to all attendees who provided a phone number during checkout.
                SMS costs credits from the shared TicketPulse account — each message costs 1 credit
                per 153-character segment, per recipient.
              </p>
            </div>
            {balance !== null && (
              <div className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3 py-1.5 text-[12px] font-semibold text-ink">
                <Wallet size={13} className="text-ink-3" />
                {balance.toLocaleString()} credits
              </div>
            )}
          </div>
          {insufficientBalance && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-[12px] text-red-700">
              Not enough credits for this broadcast — need {(recipientCount! * segments).toLocaleString()}, have {balance!.toLocaleString()}.
            </div>
          )}
        </div>

        {/* Compose message */}
        <div className="rounded-2xl border border-line bg-paper p-6 md:p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-[16px] font-semibold tracking-tight text-ink">Compose message</h2>
            <p className="text-[13px] text-ink-3">
              Use <code className="text-blue text-[12px]">{`{name}`}</code> for the recipient&apos;s
              first name and <code className="text-blue text-[12px]">{`{event}`}</code> for the event
              name.
              {recipientCount !== null && (
                <span className="ml-1.5 inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                  {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>

          <div>
            <label htmlFor="message" className="block text-[13px] font-medium text-ink mb-1.5">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Hey {name}! Just a reminder that {event} is happening this Saturday. See you there!`}
              className={inputCls(charCount > 459) + " min-h-[180px] resize-y"}
              maxLength={459}
              rows={8}
            />
            <div className="flex justify-between mt-1">
              <p className="text-[12px] text-ink-3">
                Preview:{" "}
                {message.replace(/\{name\}/g, "John").replace(/\{event\}/g, eventTitle).slice(0, 80)}
                {message.length > 80 ? "..." : ""}
              </p>
              <p className={`text-[12px] whitespace-nowrap ${charCount > 459 ? "text-red-500 font-semibold" : "text-ink-3"}`}>
                {charCount} / 459 · {segments} segment{segments !== 1 ? "s" : ""}
              </p>
            </div>
            {estimatedCost !== null && (
              <p className="mt-2 text-[12px] text-ink-3">
                Estimated cost: <span className="font-semibold text-ink">${estimatedCost}</span>{" "}
                ({recipientCount} recipient{recipientCount !== 1 ? "s" : ""} × {segments} segment
                {segments !== 1 ? "s" : ""} × ${COST_PER_SMS_USD.toFixed(2)})
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <form action={bulkAction} className="flex-1">
              <input type="hidden" name="message" value={message} />
              <button
                type="submit"
                disabled={!canSend || insufficientBalance}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <Send size={14} />
                {bulkPending
                  ? "Sending..."
                  : bulkState.sent !== undefined
                    ? `Sent to ${bulkState.sent} / ${bulkState.total}`
                    : "Send to all attendees"}
              </button>
            </form>

            <form action={testAction}>
              <input type="hidden" name="message" value={message} />
              <button
                type="submit"
                disabled={!canSend}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-3 text-[13px] font-medium text-ink hover:bg-paper-2 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <MessageSquare size={14} />
                {testPending ? "Sending..." : testState?.ok ? "Test sent!" : "Send test"}
              </button>
            </form>
          </div>

          {/* Status messages */}
          {bulkState.sent !== undefined && (
            <div
              className={`rounded-xl border px-4 py-3 text-[13px] ${
                bulkState.failed
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-green-50 border-brand-200 text-green-800"
              }`}
            >
              SMS dispatched to {bulkState.sent} of {bulkState.total} attendees.
              {!!bulkState.failed && ` ${bulkState.failed} failed to send.`}
            </div>
          )}
          {bulkState.error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-700">
              {bulkState.error}
            </div>
          )}
          {testState?.error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-700">
              {testState.error}
            </div>
          )}
          {testState?.ok && !testState?.error && (
            <div className="rounded-xl bg-green-50 border border-brand-200 px-4 py-3 text-[13px] text-green-800">
              Test message sent! Check your phone.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
