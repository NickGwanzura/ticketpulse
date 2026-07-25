"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Sparkles, Send, Loader, CheckCircle, AlertCircle, RefreshCw,
  Mail, MessageSquare, Users, UserCheck, LayoutList, Megaphone,
  Eye, X,
} from "lucide-react"

type Audience = "attendees" | "organizers" | "all_users"

const AUDIENCE_OPTIONS: { value: Audience; label: string; description: string }[] = [
  { value: "attendees", label: "Attendees", description: "All ticket buyers and event attendees" },
  { value: "organizers", label: "Organizers", description: "All event organisers and admins" },
  { value: "all_users", label: "All users", description: "Everyone registered on TicketPulse" },
]

const TONE_OPTIONS = [
  { value: "friendly", label: "Friendly", icon: "😊" },
  { value: "professional", label: "Professional", icon: "📋" },
  { value: "urgent", label: "Urgent", icon: "⚡" },
] as const

type Tone = (typeof TONE_OPTIONS)[number]["value"]

function pluralise(audience: Audience): string {
  switch (audience) {
    case "attendees": return "attendees"
    case "organizers": return "organizers"
    case "all_users": return "users"
  }
}

export default function AdminCommunicationsPage() {
  const router = useRouter()

  // ── Form state ──────────────────────────────────────────────────────────
  const [audience, setAudience] = useState<Audience>("attendees")
  const [email, setEmail] = useState(true)
  const [sms, setSms] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [topic, setTopic] = useState("")
  const [tone, setTone] = useState<Tone>("friendly")

  // ── UI state ────────────────────────────────────────────────────────────
  const [showPreview, setShowPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState<{ channel: string; target: string; success: boolean; error?: string }[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const channels = [email && "email", sms && "sms"].filter(Boolean)

  // ── GROQ AI draft ───────────────────────────────────────────────────────
  const generateDraft = useCallback(async () => {
    if (!topic.trim()) {
      setError("Describe what the announcement is about first")
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch("/api/ai/announcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), audience, tone }),
      })
      if (!res.ok) throw new Error("AI generation failed")
      const data = await res.json()
      if (data.subject) setSubject(data.subject)
      if (data.body) setBody(data.body)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate announcement")
    } finally {
      setGenerating(false)
    }
  }, [topic, audience, tone])

  // ── Send ────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (formData: FormData) => {
    setSending(true)
    setError(null)
    setResults(null)
    try {
      const res = await fetch("/api/admin/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          channels,
          subject: subject.trim(),
          body: body.trim(),
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error ?? "Failed to send")
      }
      const data = await res.json()
      setResults(data.results ?? [])
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send communication")
    } finally {
      setSending(false)
    }
  }, [audience, channels, subject, body, router])

  const previewBody = body
    .replace(/\{name\}/g, "{recipient name}")
    .replace(/\{audience\}/g, pluralise(audience))

  const canSend = subject.trim() && body.trim() && channels.length > 0

  return (
    <div className="tp-fade-up">
      {/* Header */}
      <div className="px-5 md:px-8 pt-8 md:pt-10 pb-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] uppercase text-blue mb-2">
          <Megaphone size={13} />
          Communications
        </div>
        <h1 className="text-[22px] md:text-[26px] font-bold tracking-tight text-ink">
          Send platform announcement
        </h1>
        <p className="text-[14px] text-ink-2 mt-1">
          Compose and send a broadcast message via email, SMS, or both.
        </p>
      </div>

      <div className="px-5 md:px-8 pb-10 max-w-3xl space-y-6">
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <p className="text-[13px] text-rose-700">{error}</p>
          </div>
        )}

        {/* Results summary after sending */}
        {results && (
          <div className="rounded-2xl border border-brand-200 bg-green-50 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-brand-600" />
              <h3 className="text-[14px] font-semibold text-green-800">Sent</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              {(() => {
                const emailSent = results.filter((r) => r.channel === "email" && r.success).length
                const emailFail = results.filter((r) => r.channel === "email" && !r.success).length
                const smsSent = results.filter((r) => r.channel === "sms" && r.success).length
                const smsFail = results.filter((r) => r.channel === "sms" && !r.success).length
                return (
                  <>
                    <div className="bg-white rounded-lg p-3 border border-green-100">
                      <p className="text-[11px] text-ink-3 font-medium uppercase tracking-wide">Email</p>
                      <p className="text-[18px] font-bold text-ink mt-1">{emailSent}</p>
                      {emailFail > 0 && <p className="text-[11px] text-rose-600">{emailFail} failed</p>}
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-green-100">
                      <p className="text-[11px] text-ink-3 font-medium uppercase tracking-wide">SMS</p>
                      <p className="text-[18px] font-bold text-ink mt-1">{smsSent}</p>
                      {smsFail > 0 && <p className="text-[11px] text-rose-600">{smsFail} failed</p>}
                    </div>
                  </>
                )
              })()}
            </div>
            <button
              onClick={() => { setResults(null); setSubject(""); setBody(""); setTopic("") }}
              className="text-[12px] font-semibold text-green-700 hover:text-green-800 transition-colors"
            >
              Send another
            </button>
          </div>
        )}

        {!results && (
          <>
            {/* Audience + Channels */}
            <section className="rounded-2xl border border-line bg-paper p-5 space-y-5">
              <h2 className="text-[14px] font-semibold tracking-tight text-ink">Recipients</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {AUDIENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAudience(opt.value)}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      audience === opt.value
                        ? "border-green-400 bg-green-50/60 ring-2 ring-green-500/20"
                        : "border-line bg-paper hover:bg-paper-2"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Users size={14} className={audience === opt.value ? "text-brand-600" : "text-ink-3"} />
                      <p className="text-[13px] font-semibold text-ink">{opt.label}</p>
                    </div>
                    <p className="text-[12px] text-ink-2">{opt.description}</p>
                  </button>
                ))}
              </div>

              <div>
                <p className="text-[12px] text-ink-3 mb-2.5 font-medium">Channels</p>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <div
                      onClick={() => setEmail(!email)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                        email
                          ? "border-green-400 bg-green-50 text-green-700"
                          : "border-line text-ink-2 hover:bg-paper-2"
                      }`}
                    >
                      <Mail size={13} />
                      Email
                    </div>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <div
                      onClick={() => setSms(!sms)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                        sms
                          ? "border-green-400 bg-green-50 text-green-700"
                          : "border-line text-ink-2 hover:bg-paper-2"
                      }`}
                    >
                      <MessageSquare size={13} />
                      SMS
                    </div>
                  </label>
                </div>
              </div>
            </section>

            {/* AI Draft */}
            <section className="rounded-2xl border border-brand-200/60 bg-gradient-to-br from-green-50/40 to-emerald-50/40 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-brand-600" />
                <h2 className="text-[14px] font-semibold tracking-tight text-green-800">AI Draft</h2>
              </div>
              <p className="text-[12px] text-ink-2">
                Describe what you want to announce and choose a tone — GROQ will draft the subject and body for you.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="What's the announcement about?"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
                <div className="flex gap-1.5">
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTone(t.value)}
                      className={`px-2.5 py-2 rounded-lg text-[12px] font-medium border transition-colors ${
                        tone === t.value
                          ? "border-green-400 bg-green-50 text-green-700"
                          : "border-line bg-paper text-ink-2 hover:bg-paper-2"
                      }`}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={generateDraft}
                  disabled={generating || !topic.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white px-4 py-2 text-[13px] font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 shrink-0"
                >
                  {generating ? (
                    <Loader size={13} className="animate-spin" />
                  ) : (
                    <Sparkles size={13} />
                  )}
                  {generating ? "Drafting…" : "Draft"}
                </button>
              </div>
            </section>

            {/* Compose */}
            <section className="rounded-2xl border border-line bg-paper p-5 space-y-4">
              <h2 className="text-[14px] font-semibold tracking-tight text-ink">Compose</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-[12px] font-medium text-ink-3 mb-1.5 block">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. New features and fixes on TicketPulse"
                    className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-ink-3 mb-1.5 block">
                    Message
                    <span className="text-ink-3 font-normal ml-1">
                      (use {"{name}"} for personal greeting, {"{audience}"} for audience label)
                    </span>
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Hi {name},&#10;&#10;We have some exciting updates to share..."
                    rows={10}
                    className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-y min-h-[200px]"
                  />
                </div>
              </div>
            </section>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreview(!showPreview)}
                disabled={!body.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-paper px-4 py-2.5 text-[13px] font-medium text-ink-2 hover:text-ink hover:bg-paper-2 transition-colors disabled:opacity-40"
              >
                <Eye size={14} />
                {showPreview ? "Hide preview" : "Preview"}
              </button>

              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  const formData = new FormData(e.currentTarget)
                  await handleSend(formData)
                }}
                className="flex-1"
              >
                <input type="hidden" name="audience" value={audience} />
                <input type="hidden" name="channels" value={channels.join(",")} />
                <input type="hidden" name="subject" value={subject} />
                <input type="hidden" name="body" value={body} />
                <button
                  type="submit"
                  disabled={!canSend || sending}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 text-white px-5 py-2.5 text-[13px] font-semibold shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.99] transition-all disabled:opacity-40"
                >
                  {sending ? (
                    <Loader size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  {sending
                    ? "Sending…"
                    : `Send to ${pluralise(audience)} via ${channels.join(" & ") || "—"}`}
                </button>
              </form>
            </div>

            {/* Preview */}
            {showPreview && body.trim() && (
              <div className="rounded-2xl border border-line bg-paper overflow-hidden">
                <div className="px-5 py-3 border-b border-line bg-paper-2">
                  <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-ink-3">Preview</p>
                </div>
                <div className="p-5 space-y-3 max-h-[400px] overflow-y-auto">
                  <p className="text-[14px] font-semibold text-ink">{subject}</p>
                  <div className="text-[13px] text-ink-2 leading-relaxed whitespace-pre-wrap">
                    {previewBody}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
