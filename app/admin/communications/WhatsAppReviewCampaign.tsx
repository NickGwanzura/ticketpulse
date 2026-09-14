"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle, Clock3, MessageCircle, RefreshCw, Send, ShieldCheck, Wifi, WifiOff } from "lucide-react"

type CampaignEvent = {
  id: string
  title: string
  startsAt: string
  endsAt: string | null
  eligibleRecipients: number
  eligibleEmailRecipients: number
}

type CampaignResponse = {
  provider: string
  session: { status: string; phone: string | null; lastActive: string | null }
  events: CampaignEvent[]
}

function formatDate(value: string | null) {
  if (!value) return "Date unavailable"
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export default function WhatsAppReviewCampaign() {
  const [data, setData] = useState<CampaignResponse | null>(null)
  const [eventId, setEventId] = useState("")
  const [limit, setLimit] = useState("100")
  const [channels, setChannels] = useState<Array<"whatsapp" | "email">>(["whatsapp", "email"])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ batchId: string | null; totalMessages: number; emailSent?: number; emailFailed?: number; ordersMarked: number; skippedDuplicatePhones: number; estimatedCompletionTime: string | null } | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/communications/whatsapp-review", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Could not load WhatsApp status")
      setData(payload)
      setEventId((current) => current || payload.events.find((event: CampaignEvent) => /sunset|mimosa/i.test(event.title))?.id || payload.events[0]?.id || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load WhatsApp status")
    } finally {
      setLoading(false)
    }
  }

  // Fetch the provider state once when the panel mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [])

  const selectedEvent = useMemo(() => data?.events.find((event) => event.id === eventId) ?? null, [data, eventId])
  const sessionReady = data?.session.status === "ready"
  const hasWhatsApp = channels.includes("whatsapp")
  const hasEmail = channels.includes("email")
  const eligibleCount = Math.max(
    hasWhatsApp ? (selectedEvent?.eligibleRecipients ?? 0) : 0,
    hasEmail ? (selectedEvent?.eligibleEmailRecipients ?? 0) : 0,
  )

  async function sendBatch() {
    if (!eventId) return
    setSending(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch("/api/admin/communications/whatsapp-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, limit: Number(limit), channels }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "WhatsApp batch failed")
      setResult(payload)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "WhatsApp batch failed")
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-paper overflow-hidden">
      <div className="px-5 py-4 border-b border-line flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle size={16} className="text-emerald-600" />
            <h2 className="text-[15px] font-semibold text-ink">WhatsApp review follow-up</h2>
          </div>
          <p className="text-[12px] text-ink-2 mt-1 max-w-2xl">
            Thank confirmed ticket buyers after a past event and give each buyer a personalised review link by WhatsApp, email, or both.
          </p>
        </div>
        <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${sessionReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {sessionReady ? <Wifi size={12} /> : <WifiOff size={12} />}
          OpenWA {data?.session.status ?? (loading ? "checking" : "unreachable")}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>}
        {result && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
            <div className="flex items-center gap-2 font-semibold"><CheckCircle size={15} /> Batch accepted by OpenWA</div>
            <p className="mt-1">{result.totalMessages > 0 ? `${result.totalMessages} WhatsApp messages queued. ` : ""}{result.emailSent ? `${result.emailSent} emails sent. ` : ""}{result.emailFailed ? `${result.emailFailed} emails failed. ` : ""}{result.ordersMarked} orders marked{result.batchId ? ` against batch ${result.batchId}` : ""}.</p>
            {result.skippedDuplicatePhones > 0 && <p className="mt-1 text-[12px]">{result.skippedDuplicatePhones} duplicate orders were grouped into the same phone recipient.</p>}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-[1fr_140px_auto] md:items-end">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Past event</span>
            <select
              value={eventId}
              onChange={(event) => setEventId(event.target.value)}
              disabled={loading || !data?.events.length}
              className="h-10 w-full rounded-lg border border-line bg-paper px-3 text-[13px] text-ink focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 disabled:opacity-60"
            >
              {!data?.events.length && <option value="">No past events with buyers</option>}
              {data?.events.map((event) => <option key={event.id} value={event.id}>{event.title} · {formatDate(event.endsAt ?? event.startsAt)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Batch size</span>
            <select value={limit} onChange={(event) => setLimit(event.target.value)} className="h-10 w-full rounded-lg border border-line bg-paper px-3 text-[13px] text-ink focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15">
              {[25, 50, 100].map((size) => <option key={size} value={size}>{size} recipients</option>)}
            </select>
          </label>
          <div className="md:col-span-3">
            <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Channels</span>
            <div className="flex flex-wrap gap-2">
              {(["whatsapp", "email"] as const).map((channel) => {
                const selected = channels.includes(channel)
                return (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => setChannels((current) => selected ? current.filter((item) => item !== channel) : [...current, channel])}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-colors ${selected ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-line bg-paper text-ink-2 hover:bg-paper-2"}`}
                  >
                    {channel === "whatsapp" ? <MessageCircle size={13} /> : <Send size={13} />}
                    {channel === "whatsapp" ? "WhatsApp" : "Email"}
                  </button>
                )
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void sendBatch()}
            disabled={!selectedEvent || eligibleCount === 0 || (hasWhatsApp && !sessionReady) || channels.length === 0 || sending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-[13px] font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? "Sending…" : "Send thank-you batch"}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-paper-2 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-ink-3">Eligible recipients</p>
            <p className="mt-1 text-[18px] font-bold text-ink">{eligibleCount}</p>
          </div>
          <div className="rounded-xl border border-line bg-paper-2 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-ink-3">Message</p>
          <p className="mt-1 text-[13px] font-semibold text-ink">TicketPulse service review</p>
          </div>
          <div className="rounded-xl border border-line bg-paper-2 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-ink-3">Protection</p>
            <p className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-ink"><ShieldCheck size={14} className="text-emerald-600" /> One per phone</p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[12px] text-blue-800">
          <Clock3 size={14} className="mt-0.5 shrink-0" />
          <p>Only paid/completed orders from ended events are included. OpenWA queues WhatsApp messages with a delay between sends, email is sent individually, and already-contacted buyers are skipped on later batches.</p>
        </div>

        <div className="rounded-xl border border-line bg-paper-2 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Message draft</p>
          <p className="mt-2 text-[13px] font-semibold text-ink">WhatsApp: “Thanks for using TicketPulse. How was checkout, EcoCash or card payment, ticket delivery, and support?”</p>
          <p className="mt-1 text-[12px] text-ink-2">Email subject: Tell us about your TicketPulse experience · both messages include a private review link tied to the buyer&apos;s order.</p>
        </div>
      </div>
    </section>
  )
}
