"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import jsQR from "jsqr"
import Link from "next/link"
import {
  ScanLine, Camera, CameraOff, CheckCircle2, AlertTriangle, Ticket,
  RotateCcw, ArrowLeft, ShieldCheck, Wifi, WifiOff, Trash2, User,
  Volume2, VolumeX,
} from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import { markTicketScannedAction, type ScanResult } from "./actions"

const CHECKINS_KEY = "tp_checkins"

type CheckinStatus = "valid" | "duplicate" | "unknown"

interface CheckinRecord {
  code: string
  at: string
  status: CheckinStatus
  eventTitle?: string
  tierName?: string
  holder?: string
  isStaffTicket?: boolean
  staffRole?: string
}

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): BarcodeDetectorLike
      getSupportedFormats?: () => Promise<string[]>
    }
  }
}

function loadCheckins(): CheckinRecord[] {
  try {
    const raw = localStorage.getItem(CHECKINS_KEY)
    return raw ? (JSON.parse(raw) as CheckinRecord[]) : []
  } catch { return [] }
}

function saveCheckins(list: CheckinRecord[]) {
  try { localStorage.setItem(CHECKINS_KEY, JSON.stringify(list)) } catch {}
}

export default function OrganizerScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastSeenRef = useRef<{ code: string; at: number } | null>(null)
  const recentRef = useRef<CheckinRecord[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const autoStartedRef = useRef(false)

  const [cameraState, setCameraState] = useState<"idle" | "starting" | "running" | "denied" | "unsupported">("idle")
  const [recent, setRecent] = useState<CheckinRecord[]>([])
  const [manual, setManual] = useState("")
  const [latest, setLatest] = useState<CheckinRecord | null>(null)
  const [online, setOnline] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)

  useEffect(() => {
    queueMicrotask(() => {
      setRecent(loadCheckins())
      if (typeof navigator !== "undefined") setOnline(navigator.onLine)
    })
    const onUp = () => setOnline(true)
    const onDown = () => setOnline(false)
    window.addEventListener("online", onUp)
    window.addEventListener("offline", onDown)
    return () => {
      window.removeEventListener("online", onUp)
      window.removeEventListener("offline", onDown)
    }
  }, [])

  useEffect(() => { recentRef.current = recent }, [recent])

  const stats = useMemo(() => {
    const valid = recent.filter((r) => r.status === "valid").length
    const dupes = recent.filter((r) => r.status === "duplicate").length
    const unknown = recent.filter((r) => r.status === "unknown").length
    return { valid, dupes, unknown, total: recent.length }
  }, [recent])

  const ensureAudio = useCallback(async () => {
    if (typeof window === "undefined") return null
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return null
    const ctx = audioCtxRef.current ?? new AudioContextCtor()
    audioCtxRef.current = ctx
    if (ctx.state === "suspended") await ctx.resume().catch(() => {})
    return ctx
  }, [])

  const playScanSound = useCallback(async (status: CheckinStatus) => {
    if (!soundEnabled) return
    const ctx = await ensureAudio()
    if (!ctx) return

    const now = ctx.currentTime
    const pattern =
      status === "valid"
        ? [{ f: 880, t: 0, d: 0.08 }, { f: 1175, t: 0.1, d: 0.09 }]
        : status === "duplicate"
          ? [{ f: 520, t: 0, d: 0.1 }, { f: 390, t: 0.13, d: 0.12 }]
          : [{ f: 180, t: 0, d: 0.16 }, { f: 140, t: 0.18, d: 0.16 }]

    for (const note of pattern) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = status === "unknown" ? "sawtooth" : "sine"
      osc.frequency.setValueAtTime(note.f, now + note.t)
      gain.gain.setValueAtTime(0.0001, now + note.t)
      gain.gain.exponentialRampToValueAtTime(status === "valid" ? 0.16 : 0.11, now + note.t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.t + note.d)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + note.t)
      osc.stop(now + note.t + note.d + 0.02)
    }
  }, [ensureAudio, soundEnabled])

  const vibrateForStatus = useCallback((status: CheckinStatus) => {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return
    const pattern = status === "valid" ? [35] : status === "duplicate" ? [45, 35, 45] : [80, 40, 80]
    navigator.vibrate(pattern)
  }, [])

  const recordCheckin = useCallback(async (rawCode: string) => {
    const code = rawCode.trim()
    if (!code) return
    const now = Date.now()
    const last = lastSeenRef.current
    if (last && last.code === code && now - last.at < 1500) return
    lastSeenRef.current = { code, at: now }

    let status: CheckinStatus = "unknown"
    let eventTitle: string | undefined
    let tierName: string | undefined
    let holder: string | undefined
    let isStaffTicket: boolean | undefined
    let staffRole: string | undefined

    // Test ticket codes (SampleTicket generates `TEST-{tierId.slice(-6)}`)
    if (/^TEST-/i.test(code)) {
      const dup = recentRef.current.find((r) => r.code === code && r.status === "valid")
      status = dup ? "duplicate" : "valid"
      eventTitle = "🧪 Sample ticket"
      tierName = "Test QR code — not valid for entry"
    } else {
      // Server-first validation — always hit the database for authoritative ticket status
      if (navigator.onLine) {
	        try {
	          const result: ScanResult = await markTicketScannedAction(code)
	          if (result.ok) {
	            status = result.status === "duplicate" ? "duplicate" : "valid"
	            eventTitle = result.ticket?.eventTitle
	            tierName = result.ticket?.tierName
	            holder = result.ticket?.holder
	            isStaffTicket = result.ticket?.isStaffTicket
	            staffRole = result.ticket?.staffRole
	          } else {
	            // Show server error in the tier/event fields so the operator sees why
	            eventTitle = "❌ Scan failed"
	            tierName = result.error ?? "Scan failed"
	          }
	        } catch {
	          // Server lookup failed — keep as "unknown"
	        }
      }
    }

    const rec: CheckinRecord = {
      code,
      at: new Date().toISOString(),
      status,
      eventTitle,
      tierName,
      holder,
      isStaffTicket,
      staffRole,
    }
    setLatest(rec)
    setRecent((prev) => {
      const next = [rec, ...prev].slice(0, 50)
      saveCheckins(next)
      return next
    })
    playScanSound(rec.status)
    vibrateForStatus(rec.status)
  }, [playScanSound, vibrateForStatus])

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraState("idle")
  }, [])

  const startCamera = useCallback(async () => {
    if (typeof window === "undefined") return
    await ensureAudio()
    const hasDetector = !!window.BarcodeDetector
    if (!hasDetector) {
      setCameraState("starting")
    } else {
      setCameraState("starting")
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }

      if (hasDetector) {
        const BarcodeDetectorCtor = window.BarcodeDetector!
        detectorRef.current = new BarcodeDetectorCtor({ formats: ["qr_code"] })
      }

      setCameraState("running")

      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")

      const tick = async () => {
        const video = videoRef.current
        if (!video || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick)
          return
        }

        if (hasDetector && detectorRef.current) {
          // Native BarcodeDetector path
          try {
            const codes = await detectorRef.current.detect(video)
            if (codes.length) recordCheckin(codes[0].rawValue)
          } catch {}
        } else if (ctx) {
          // jsQR fallback path — capture video frame to canvas and decode
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height)
          if (code) recordCheckin(code.data)
        }

        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      console.warn("camera denied or unavailable", err)
      setCameraState("denied")
    }
  }, [ensureAudio, recordCheckin])

  useEffect(() => {
    if (autoStartedRef.current || cameraState !== "idle") return
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return

    let cancelled = false
    navigator.permissions
      .query({ name: "camera" as PermissionName })
      .then((permission) => {
        if (cancelled || autoStartedRef.current || permission.state !== "granted") return
        autoStartedRef.current = true
        startCamera()
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [cameraState, startCamera])

  useEffect(() => () => stopCamera(), [stopCamera])

  const onManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manual.trim()) return
    ensureAudio()
    recordCheckin(manual)
    setManual("")
  }

  const clearLog = () => {
    setRecent([])
    saveCheckins([])
    setLatest(null)
  }

  const cameraSupported = typeof window !== "undefined" && (!!window.BarcodeDetector || typeof jsQR !== "undefined")
  const latestTone = !latest
    ? {
        shell: "border-line bg-paper",
        badge: "bg-paper-2 text-ink ring-line",
        title: "Awaiting scan",
        body: "Hold a QR code in front of the camera, or enter a code manually.",
      }
    : latest.status === "valid"
      ? {
          shell: "border-emerald-200 bg-emerald-50/80 ring-1 ring-emerald-200/60",
          badge: "bg-emerald-600 text-white ring-emerald-700/20",
          title: "Admit guest",
          body: "Ticket is valid and has been checked in.",
        }
      : latest.status === "duplicate"
        ? {
            shell: "border-amber-200 bg-amber-50/80 ring-1 ring-amber-200/60",
            badge: "bg-amber-500 text-white ring-amber-700/20",
            title: "Already scanned",
            body: "This ticket was previously checked in. Do not admit without manual review.",
          }
        : {
            shell: "border-rose-200 bg-rose-50/80 ring-1 ring-rose-200/60",
            badge: "bg-rose-600 text-white ring-rose-700/20",
            title: "Reject ticket",
            body: "TicketPulse could not verify this code for entry.",
          }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-paper tp-fade-up md:static md:z-auto">
      <div className="hidden md:block">
        <PageHeader
          eyebrow="Gate scanner"
          title="Scan tickets at the gate"
          subtitle="Native QR reader, no third-party app, no extra hardware."
          width="xl"
          actions={
            <Link
              href="/organizer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-medium text-ink hover:border-line-2 transition-colors"
            >
              <ArrowLeft size={14} /> Back to dashboard
            </Link>
          }
        />
      </div>

      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-ink px-4 py-3 text-white shadow-sm md:hidden">
        <Link href="/organizer" className="inline-flex items-center gap-2 text-[13px] font-semibold text-white">
          <ArrowLeft size={15} /> Scanner
        </Link>
        <button
          type="button"
          onClick={() => setSoundEnabled((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white"
          aria-label={soundEnabled ? "Mute scan sounds" : "Enable scan sounds"}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </div>

      <div className="mx-auto max-w-7xl space-y-4 px-3 pb-6 pt-3 md:space-y-6 md:px-8 md:py-10">
        {/* Trust strip */}
        <div className="hidden rounded-2xl border border-line bg-paper p-4 text-[13px] text-ink-2 md:flex md:flex-wrap md:items-center md:gap-x-6 md:gap-y-3 md:p-5">
          <span className="inline-flex items-center gap-2"><ShieldCheck size={14} className="text-brand-600" /> End-to-end on TicketPulse. We issue, you scan.</span>
          <span className="inline-flex items-center gap-2"><Ticket size={14} className="text-ink-3" /> Reads PDF, mobile QR, and Apple/Google Wallet.</span>
          <span className={`inline-flex items-center gap-2 ${online ? "text-green-700" : "text-amber-700"}`}>
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}
            {online ? "Online · live sync" : "Offline · queued, syncs on reconnect"}
          </span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
          {[
            { l: "Checked in", v: stats.valid, color: "text-green-700" },
            { l: "Duplicates", v: stats.dupes, color: "text-amber-700" },
            { l: "Rejected",   v: stats.unknown, color: "text-rose-700" },
            { l: "Total scans", v: stats.total, color: "text-ink" },
          ].map((k) => (
            <div key={k.l} className="rounded-xl border border-line bg-paper p-3 shadow-sm shadow-ink/[0.02] md:rounded-2xl md:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3 md:text-[11px]">{k.l}</p>
              <p className={`mt-1 text-[28px] font-bold tracking-tight tabular-nums md:text-[32px] ${k.color}`}>{k.v}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-4 md:gap-6">
          {/* Scanner */}
          <div className="col-span-12 overflow-hidden rounded-2xl border border-line bg-paper shadow-sm shadow-ink/[0.03] lg:col-span-7">
            <div className="flex items-center justify-between border-b border-line px-4 py-3 md:px-6 md:py-4">
              <h2 className="text-[16px] font-semibold tracking-tight text-ink inline-flex items-center gap-2">
                <ScanLine size={16} className="text-brand-600" /> Scanner
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSoundEnabled((v) => !v)}
                  className="hidden items-center gap-2 rounded-xl border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:border-line-2 md:inline-flex"
                >
                  {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                  {soundEnabled ? "Sound on" : "Muted"}
                </button>
                {cameraState === "running" ? (
                  <button
                    onClick={stopCamera}
                    className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink hover:border-line-2 transition-colors"
                  >
                    <CameraOff size={13} /> Stop camera
                  </button>
                ) : (
                  <button
                    onClick={startCamera}
                    disabled={!cameraSupported || cameraState === "starting"}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <Camera size={13} /> {cameraState === "starting" ? "Starting…" : "Start camera"}
                  </button>
                )}
              </div>
            </div>

            <div className="relative h-[62vh] min-h-[360px] bg-ink/95 md:aspect-video md:h-auto md:min-h-0">
              <video
                ref={videoRef}
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Scan reticle overlay */}
              {cameraState === "running" && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-[58%] aspect-square max-w-[360px]">
                    <span className="absolute -top-px -left-px w-10 h-10 border-l-2 border-t-2 border-white/90 rounded-tl-md" />
                    <span className="absolute -top-px -right-px w-10 h-10 border-r-2 border-t-2 border-white/90 rounded-tr-md" />
                    <span className="absolute -bottom-px -left-px w-10 h-10 border-l-2 border-b-2 border-white/90 rounded-bl-md" />
                    <span className="absolute -bottom-px -right-px w-10 h-10 border-r-2 border-b-2 border-white/90 rounded-br-md" />
                    <span className="absolute left-2 right-2 top-1/2 h-px bg-green-500/80 shadow-[0_0_12px_2px_rgba(5,112,222,0.6)] animate-pulse" />
                  </div>
                </div>
              )}

              {latest && (
                <div className="pointer-events-none absolute inset-x-3 bottom-3 md:hidden">
                  <div className={`rounded-2xl border px-4 py-3 shadow-xl backdrop-blur ${latestTone.shell}`}>
                    <p className="text-[20px] font-bold tracking-tight text-ink">{latestTone.title}</p>
                    <p className="mt-0.5 text-[12px] font-medium text-ink-2">{latest.holder ?? latest.eventTitle ?? latestTone.body}</p>
                  </div>
                </div>
              )}

              {cameraState === "idle" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 gap-3 px-6 text-center">
                  <Camera size={28} />
                  <p className="text-[14px] font-medium text-white">Tap <span className="text-green-300">Start camera</span> to begin scanning</p>
                  <p className="text-[12px] text-white/60 max-w-sm">Allow camera access. Point the rear camera at any TicketPulse QR: printed PDF, phone, or wallet pass.</p>
                </div>
              )}
              {cameraState === "denied" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 gap-2 px-6 text-center">
                  <CameraOff size={26} />
                  <p className="text-[14px] font-medium">Camera blocked</p>
                  <p className="text-[12px] text-white/70 max-w-sm">Grant camera permission in your browser, or use the manual entry field below.</p>
                </div>
              )}
              {cameraState === "unsupported" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 gap-2 px-6 text-center">
                  <AlertTriangle size={26} />
                  <p className="text-[14px] font-medium">Camera not available</p>
                  <p className="text-[12px] text-white/70 max-w-sm">Grant camera permission or use the manual entry field below.</p>
                </div>
              )}
            </div>

            {/* Manual entry */}
            <form onSubmit={onManualSubmit} className="flex gap-2 border-t border-line px-4 py-3 md:px-6 md:py-4">
              <input
                type="text"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Manual entry: paste or type ticket code (e.g. TP-XXXXX-...)"
                className="h-12 flex-1 rounded-xl border border-line bg-paper px-4 text-[14px] text-ink placeholder:text-ink-3 transition focus:border-green-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Verify
              </button>
            </form>
          </div>

          {/* Latest + log */}
          <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
            {/* Latest result */}
            <div className={`tp-slide-up rounded-2xl border p-5 shadow-sm shadow-ink/[0.03] md:p-6 ${latestTone.shell}`}>
              {!latest ? (
                <div className="tp-fade-up">
                  <p className="text-[20px] font-bold tracking-tight text-ink md:text-[24px]">{latestTone.title}</p>
                  <p className="mt-1 text-[13px] text-ink-2">{latestTone.body}</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-bold uppercase tracking-wide ring-1 ${latestTone.badge}`}>
                      {latest.status === "valid" ? <CheckCircle2 size={15} /> : latest.status === "duplicate" ? <RotateCcw size={15} /> : <AlertTriangle size={15} />}
                      {latestTone.title}
                    </span>
                    {latest.isStaffTicket && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700">
                        <User size={11} /> Staff
                      </span>
                    )}
                  </div>

                  {latest.isStaffTicket ? (
                    <>
                      <p className="text-[24px] font-bold tracking-tight text-ink line-clamp-2 md:text-[28px]">
                        {latest.eventTitle ?? "Unknown event"}
                      </p>
                      <div className="mt-2 flex items-center gap-3 rounded-xl border border-purple-100 bg-purple-50/40 px-3.5 py-2.5 transition-all">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                          <User size={16} />
                        </div>
                        <div>
                          <p className="text-[14px] font-semibold text-ink">{latest.holder ?? "Staff member"}</p>
                          <p className="text-[12px] text-ink-2 capitalize">{latest.staffRole?.replace(/_/g, " ") ?? "Staff"}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-[24px] font-bold tracking-tight text-ink line-clamp-2 md:text-[28px]">
                        {latest.eventTitle ?? "Unknown ticket"}
                      </p>
                      {latest.tierName && <p className="text-[13px] text-ink-2 mt-0.5">{latest.tierName}</p>}
                      {latest.holder && <p className="text-[13px] text-ink-2 mt-0.5">Holder: <span className="font-medium text-ink">{latest.holder}</span></p>}
                    </>
                  )}

                  {/* Subtle progress bar — visual indicator of freshness */}
                  <p className="mt-3 rounded-xl bg-white/55 px-3 py-2 text-[13px] font-medium text-ink-2 ring-1 ring-line/60">
                    {latestTone.body}
                  </p>

                  <span className="mt-3 block h-px w-full bg-line overflow-hidden rounded-full" aria-hidden>
                    <span className="block h-px bg-green-500/40 rounded-full" style={{ animation: "tp-progress 2.4s cubic-bezier(0.22, 0.61, 0.36, 1) both" }} />
                  </span>

                  <p className="mt-2 text-[11px] font-mono text-ink-3 tabular-nums break-all">{latest.code}</p>
                </>
              )}
            </div>

            {/* Log */}
            <div className="flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-sm shadow-ink/[0.03]">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
                <h3 className="text-[14px] font-semibold tracking-tight text-ink">Recent scans</h3>
                {recent.length > 0 && (
                  <button onClick={clearLog} className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink transition-colors">
                    <Trash2 size={12} /> Clear
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                {recent.length === 0 ? (
                  <p className="px-5 py-8 text-center text-[13px] text-ink-3">No scans yet. Start the camera or use manual entry.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {recent.map((r, i) => (
                      <li key={`${r.code}-${i}`} className="px-5 py-3 flex items-start gap-3">
                        <span className={`mt-0.5 inline-flex w-6 h-6 items-center justify-center rounded-md text-[11px] font-bold ${
                          r.status === "valid" ? "bg-green-50 text-green-700" :
                          r.status === "duplicate" ? "bg-amber-50 text-amber-700" :
                          "bg-rose-50 text-rose-700"
                        }`}>
                          {r.status === "valid" ? "✓" : r.status === "duplicate" ? "↻" : "!"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-ink truncate flex items-center gap-1.5">
                            {r.eventTitle ?? "Unknown ticket"}
                            {r.isStaffTicket && (
                              <span className="inline-flex items-center gap-0.5 rounded-full border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[9px] font-semibold text-purple-700 shrink-0">
                                Staff
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] font-mono text-ink-3 truncate">{r.code}</p>
                        </div>
                        <p className="text-[11px] text-ink-3 shrink-0 tabular-nums">
                          {new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
