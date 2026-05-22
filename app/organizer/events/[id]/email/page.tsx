"use client"

import { useActionState, useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Send, MailCheck } from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import { sendBulkEmailAction, sendTestEmailAction, type EmailFormState } from "./actions"
import AiEmailCopilot from "@/components/ai/AiEmailCopilot"

function inputCls(hasError?: boolean) {
  return [
    "w-full rounded-xl border bg-paper px-4 py-3 text-[14px] text-ink placeholder:text-ink-3",
    "focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue transition",
    hasError ? "border-red-400" : "border-line",
  ].join(" ")
}

export default function EmailPage() {
  const params = useParams<{ id: string }>()
  const eventId = params.id

  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [eventTitle, setEventTitle] = useState("your event")
  const [eventDate, setEventDate] = useState("")

  const [bulkState, bulkAction, bulkPending] = useActionState<EmailFormState, FormData>(
    sendBulkEmailAction.bind(null, eventId),
    { ok: false },
  )

  const [testState, testAction, testPending] = useActionState<
    { ok: boolean; error?: string } | undefined,
    FormData
  >(sendTestEmailAction.bind(null, eventId), undefined)

  // Fetch recipient count and event details on mount
  useEffect(() => {
    fetch(`/api/events/${eventId}/attendees/export`, { method: "HEAD" })
      .catch(() => {})
    // Fetch event title for AI copilot
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const ev = data.find((e: { id: string }) => e.id === eventId)
          if (ev) {
            setEventTitle(ev.title ?? "your event")
            if (ev.startsAt) {
              setEventDate(new Date(ev.startsAt).toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric",
              }))
            }
          }
        }
      })
      .catch(() => {})
  }, [eventId])

  const canSend = subject.trim() && message.trim() && !bulkPending && !testPending

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title="Email attendees"
        actions={
          <Link
            href={`/organizer/events/${eventId}/edit`}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} />
            Back to event
          </Link>
        }
      />

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-6">
        {/* AI Email Copilot */}
        <AiEmailCopilot
          eventTitle={eventTitle}
          eventDate={eventDate}
          onGenerated={(data) => {
            setSubject(data.subject)
            setMessage(data.body)
          }}
        />

        <div className="rounded-2xl border border-line bg-paper p-6 md:p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-[16px] font-semibold tracking-tight text-ink">Compose message</h2>
            <p className="text-[12.5px] text-ink-3">
              Use <code className="text-blue text-[12px]">{`{name}`}</code> for the recipient's first name and{" "}
              <code className="text-blue text-[12px]">{`{event}`}</code> for the event name.
            </p>
          </div>

          {/* Subject */}
          <div>
            <label htmlFor="subject" className="block text-[13px] font-medium text-ink mb-1.5">
              Subject
            </label>
            <input
              id="subject"
              name="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Important update about Summer Festival"
              className={inputCls()}
              maxLength={200}
            />
          </div>

          {/* Message */}
          <div>
            <label htmlFor="message" className="block text-[13px] font-medium text-ink mb-1.5">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Hi {name},\n\nJust a reminder that {event} is coming up soon...`}
              className={inputCls() + " min-h-[200px] resize-y"}
              maxLength={50000}
              rows={8}
            />
            <p className="mt-1 text-[11.5px] text-ink-3 text-right">{message.length} / 50,000</p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            {/* Send to all */}
            <form action={bulkAction} className="flex-1">
              <button
                type="submit"
                disabled={!canSend}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 text-[13px] font-semibold text-white hover:bg-ink-2 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <Send size={14} />
                {bulkPending ? "Sending..." : bulkState.ok ? `Sent to ${bulkState.sent} / ${bulkState.total}` : "Send to all attendees"}
              </button>
            </form>

            {/* Send test */}
            <form action={testAction}>
              <button
                type="submit"
                disabled={!canSend}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-3 text-[13px] font-medium text-ink hover:bg-paper-2 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <MailCheck size={14} />
                {testPending ? "Sending..." : testState?.ok ? "Test sent!" : "Send test"}
              </button>
            </form>
          </div>

          {/* Status messages */}
          {bulkState.ok && bulkState.total && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-[13px] text-emerald-800">
              Email sent to {bulkState.sent} of {bulkState.total} attendees.
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
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-[13px] text-emerald-800">
              Test email sent! Check your inbox.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
