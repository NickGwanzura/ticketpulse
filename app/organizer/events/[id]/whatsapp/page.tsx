"use client"

import { useActionState, useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Send, Smartphone } from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import {
  sendBulkWhatsAppAction,
  sendTestWhatsAppAction,
  getAttendeePhoneCount,
  type WhatsAppFormState,
} from "./actions"

function inputCls(hasError?: boolean) {
  return [
    "w-full rounded-xl border bg-paper px-4 py-3 text-[14px] text-ink placeholder:text-ink-3",
    "focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-green-500 transition",
    hasError ? "border-red-400" : "border-line",
  ].join(" ")
}

export default function WhatsAppPage() {
  const params = useParams<{ id: string }>()
  const eventId = params.id

  const [message, setMessage] = useState("")
  const [eventTitle, setEventTitle] = useState("your event")
  const [recipientCount, setRecipientCount] = useState<number | null>(null)

  const [bulkState, bulkAction, bulkPending] = useActionState<
    WhatsAppFormState,
    FormData
  >(sendBulkWhatsAppAction.bind(null, eventId), { ok: false })

  const [testState, testAction, testPending] = useActionState<
    { ok: boolean; error?: string } | undefined,
    FormData
  >(sendTestWhatsAppAction.bind(null, eventId), undefined)

  // Fetch event title and recipient count on mount
  useEffect(() => {
    getAttendeePhoneCount(eventId).then(setRecipientCount).catch(() => {})
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const ev = data.find((e: { id: string }) => e.id === eventId)
          if (ev) {
            setEventTitle(ev.title ?? "your event")
          }
        }
      })
      .catch(() => {})
  }, [eventId])

  const canSend = message.trim() && message.length <= 4096 && !bulkPending && !testPending
  const charCount = message.length

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title="WhatsApp broadcast"
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
              <Smartphone size={18} className="text-brand-600" />
            </div>
            <div className="space-y-1">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">
                WhatsApp messaging
              </h2>
              <p className="text-[13px] text-ink-3 leading-relaxed">
                Send a WhatsApp message to all attendees who provided a phone
                number during checkout. Messages are sent via the connected
                WhatsApp Business account with a 3-second delay between each
                recipient.
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-[12px] text-amber-800">
            <strong>Limits:</strong> Max 100 recipients per broadcast. Max 4,096 characters per message.
          </div>
        </div>

        {/* Compose message */}
        <div className="rounded-2xl border border-line bg-paper p-6 md:p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-[16px] font-semibold tracking-tight text-ink">
              Compose message
            </h2>
            <p className="text-[13px] text-ink-3">
              Use <code className="text-blue text-[12px]">{`{name}`}</code> for
              the recipient's first name and{" "}
              <code className="text-blue text-[12px]">{`{event}`}</code> for the
              event name. Supports WhatsApp formatting:{" "}
              <code className="text-blue text-[12px]">*bold*</code>,{" "}
              <code className="text-blue text-[12px]">_italic_</code>,{" "}
              <code className="text-blue text-[12px]">~strikethrough~</code>.
              {recipientCount !== null && (
                <span className="ml-1.5 inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                  {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>

          {/* Message */}
          <div>
            <label
              htmlFor="message"
              className="block text-[13px] font-medium text-ink mb-1.5"
            >
              Message
            </label>
            <textarea
              id="message"
              name="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Hey {name}! Just a reminder that {event} is happening this Saturday. See you there! 🎉`}
              className={inputCls(charCount > 4096) + " min-h-[220px] resize-y"}
              maxLength={4096}
              rows={10}
            />
            <div className="flex justify-between mt-1">
              <p className="text-[12px] text-ink-3">
                Preview:{" "}
                {message
                  .replace(/\{name\}/g, "John")
                  .replace(/\{event\}/g, eventTitle)
                  .slice(0, 80)}
                {message.length > 80 ? "..." : ""}
              </p>
              <p
                className={`text-[12px] ${
                  charCount > 4096 ? "text-red-500 font-semibold" : "text-ink-3"
                }`}
              >
                {charCount} / 4,096
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            {/* Send to all */}
            <form action={bulkAction} className="flex-1">
              <button
                type="submit"
                disabled={!canSend}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <Send size={14} />
                {bulkPending
                  ? "Sending..."
                  : bulkState.ok
                    ? `Sent to ${bulkState.sent} / ${bulkState.total}`
                    : "Send to all attendees"}
              </button>
            </form>

            {/* Send test */}
            <form action={testAction}>
              <button
                type="submit"
                disabled={!canSend}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-3 text-[13px] font-medium text-ink hover:bg-paper-2 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <Smartphone size={14} />
                {testPending ? "Sending..." : testState?.ok ? "Test sent!" : "Send test"}
              </button>
            </form>
          </div>

          {/* Status messages */}
          {bulkState.ok && bulkState.total && (
            <div className="rounded-xl bg-green-50 border border-brand-200 px-4 py-3 text-[13px] text-green-800">
              WhatsApp messages dispatched to {bulkState.sent} of{" "}
              {bulkState.total} attendees.
              {bulkState.batchId && (
                <span className="block text-[12px] mt-1 text-brand-600">
                  Batch ID: {bulkState.batchId}
                </span>
              )}
            </div>
          )}
          {bulkState.error && !bulkState.ok && (
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
              Test message sent! Check your WhatsApp.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
