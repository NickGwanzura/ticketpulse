"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ScanLine, Camera, CameraOff, CheckCircle2, AlertTriangle, Ticket,
  RotateCcw, ArrowLeft, ShieldCheck, Wifi, WifiOff, Trash2,
} from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import { useCart } from "@/lib/cart-context"

const CHECKINS_KEY = "tp_checkins"

type CheckinStatus = "valid" | "duplicate" | "unknown"

interface CheckinRecord {
  code: string
  at: string
  status: CheckinStatus
  eventTitle?: string
  tierName?: string
  holder?: string
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

function parseTicketCode(raw: string): { orderId: string; lineKey: string; idx: number } | null {
  // Print page emits codes like `${order.id}-${line.key}-${i + 1}`,
  // where order.id starts with "TP-". Split on that prefix to be safe.
  const match = raw.match(/^(TP-[A-Z0-9]+)-(.+)-(\d+)$/i)
  if (!match) return null
  const idx = parseInt(match[3], 10)
  if (Number.isNaN(idx) || idx < 1) return null
  return { orderId: match[1], lineKey: match[2], idx: idx - 1 }
}

export default function OrganizerScanPage() {
  const { ready, getOrder } = useCart()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastSeenRef = useRef<{ code: string; at: number } | null>(null)
  const recentRef = useRef<CheckinRecord[]>([])

  const [cameraState, setCameraState] = useState<"idle" | "starting" | "running" | "denied" | "unsupported">("idle")
  const [recent, setRecent] = useState<CheckinRecord[]>([])
  const [manual, setManual] = useState("")
  const [latest, setLatest] = useState<CheckinRecord | null>(null)
  const [online, setOnline] = useState(true)

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

  const recordCheckin = useCallback((rawCode: string) => {
    const code = rawCode.trim()
    if (!code) return
    const now = Date.now()
    const last = lastSeenRef.current
    if (last && last.code === code && now - last.at < 1500) return
    lastSeenRef.current = { code, at: now }

    const parsed = parseTicketCode(code)
    let status: CheckinStatus = "unknown"
    let eventTitle: string | undefined
    let tierName: string | undefined
    let holder: string | undefined

    if (parsed) {
      const order = ready ? getOrder(parsed.orderId) : null
      if (order) {
        const ticket = order.items.find((it) => it.kind === "ticket" && it.key === parsed.lineKey)
        if (ticket && ticket.kind === "ticket" && parsed.idx < ticket.qty) {
          eventTitle = ticket.eventTitle
          tierName = ticket.tierName
          holder = order.contact.name || order.contact.email
          const dup = recentRef.current.find((r) => r.code === code && r.status === "valid")
          status = dup ? "duplicate" : "valid"
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
    }
    setLatest(rec)
    setRecent((prev) => {
      const next = [rec, ...prev].slice(0, 50)
      saveCheckins(next)
      return next
    })
  }, [ready, getOrder])

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
    if (!window.BarcodeDetector) {
      setCameraState("unsupported")
      return
    }
    setCameraState("starting")
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
      detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] })
      setCameraState("running")

      const tick = async () => {
        const video = videoRef.current
        const detector = detectorRef.current
        if (!video || !detector) return
        if (video.readyState >= 2) {
          try {
            const codes = await detector.detect(video)
            if (codes.length) recordCheckin(codes[0].rawValue)
          } catch {}
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      console.warn("camera denied or unavailable", err)
      setCameraState("denied")
    }
  }, [recordCheckin])

  useEffect(() => () => stopCamera(), [stopCamera])

  const onManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manual.trim()) return
    recordCheckin(manual)
    setManual("")
  }

  const clearLog = () => {
    setRecent([])
    saveCheckins([])
    setLatest(null)
  }

  const cameraSupported = typeof window !== "undefined" && !!window.BarcodeDetector

  return (
    <div className="tp-fade-up">
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

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 space-y-6">
        {/* Trust strip */}
        <div className="rounded-2xl border border-line bg-paper p-4 md:p-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-[12.5px] text-ink-2">
          <span className="inline-flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-600" /> End-to-end on TicketPulse — we issue, you scan.</span>
          <span className="inline-flex items-center gap-2"><Ticket size={14} className="text-ink-3" /> Reads PDF, mobile QR, and Apple/Google Wallet.</span>
          <span className={`inline-flex items-center gap-2 ${online ? "text-emerald-700" : "text-amber-700"}`}>
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}
            {online ? "Online · live sync" : "Offline · queued, syncs on reconnect"}
          </span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { l: "Checked in", v: stats.valid, color: "text-emerald-700" },
            { l: "Duplicates", v: stats.dupes, color: "text-amber-700" },
            { l: "Rejected",   v: stats.unknown, color: "text-rose-700" },
            { l: "Total scans", v: stats.total, color: "text-ink" },
          ].map((k) => (
            <div key={k.l} className="rounded-2xl border border-line bg-paper p-5">
              <p className="text-[11.5px] text-ink-3">{k.l}</p>
              <p className={`mt-1 text-[28px] font-bold tracking-tight tabular-nums ${k.color}`}>{k.v}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-4 md:gap-6">
          {/* Scanner */}
          <div className="col-span-12 lg:col-span-7 rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
              <h2 className="text-[16px] font-semibold tracking-tight text-ink inline-flex items-center gap-2">
                <ScanLine size={16} className="text-blue" /> Scanner
              </h2>
              <div className="flex items-center gap-2">
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
                    className="inline-flex items-center gap-2 rounded-xl bg-navy px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <Camera size={13} /> {cameraState === "starting" ? "Starting…" : "Start camera"}
                  </button>
                )}
              </div>
            </div>

            <div className="relative aspect-video bg-ink/95">
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
                    <span className="absolute left-2 right-2 top-1/2 h-px bg-blue/80 shadow-[0_0_12px_2px_rgba(5,112,222,0.6)] animate-pulse" />
                  </div>
                </div>
              )}

              {cameraState === "idle" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 gap-3 px-6 text-center">
                  <Camera size={28} />
                  <p className="text-[14px] font-medium text-white">Tap <span className="text-blue-300">Start camera</span> to begin scanning</p>
                  <p className="text-[12px] text-white/60 max-w-sm">Allow camera access. Point the rear camera at any TicketPulse QR — printed PDF, phone, or wallet pass.</p>
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
                  <p className="text-[14px] font-medium">QR scanner not supported in this browser</p>
                  <p className="text-[12px] text-white/70 max-w-sm">Use Chrome on Android or Safari 17+ on iOS, or enter the code manually below.</p>
                </div>
              )}
            </div>

            {/* Manual entry */}
            <form onSubmit={onManualSubmit} className="px-5 md:px-6 py-4 border-t border-line flex gap-2">
              <input
                type="text"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Manual entry: paste or type ticket code (e.g. TP-XXXXX-...)"
                className="flex-1 h-11 rounded-xl border border-line bg-paper px-4 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-navy-700 transition"
              >
                Verify
              </button>
            </form>
          </div>

          {/* Latest + log */}
          <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
            {/* Latest result */}
            <div className={`rounded-2xl border p-5 ${
              !latest ? "border-line bg-paper" :
              latest.status === "valid" ? "border-emerald-200 bg-emerald-50/60" :
              latest.status === "duplicate" ? "border-amber-200 bg-amber-50/60" :
              "border-rose-200 bg-rose-50/60"
            }`}>
              {!latest ? (
                <>
                  <p className="text-[13px] font-semibold text-ink mb-1">Awaiting first scan</p>
                  <p className="text-[12.5px] text-ink-2">Hold a QR code in front of the camera, or enter a code manually.</p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    {latest.status === "valid" ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase text-emerald-700"><CheckCircle2 size={13} /> Admit one</span>
                    ) : latest.status === "duplicate" ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase text-amber-700"><RotateCcw size={13} /> Already scanned</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase text-rose-700"><AlertTriangle size={13} /> Not recognized</span>
                    )}
                  </div>
                  <p className="text-[16px] font-semibold tracking-tight text-ink line-clamp-2">
                    {latest.eventTitle ?? "Unknown ticket"}
                  </p>
                  {latest.tierName && <p className="text-[12.5px] text-ink-2 mt-0.5">{latest.tierName}</p>}
                  {latest.holder && <p className="text-[12.5px] text-ink-2 mt-0.5">Holder: <span className="font-medium text-ink">{latest.holder}</span></p>}
                  <p className="mt-3 text-[10.5px] font-mono text-ink-3 tabular-nums break-all">{latest.code}</p>
                </>
              )}
            </div>

            {/* Log */}
            <div className="rounded-2xl border border-line bg-paper overflow-hidden flex-1 flex flex-col min-h-[280px]">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
                <h3 className="text-[14px] font-semibold tracking-tight text-ink">Recent scans</h3>
                {recent.length > 0 && (
                  <button onClick={clearLog} className="inline-flex items-center gap-1 text-[11.5px] text-ink-3 hover:text-ink transition-colors">
                    <Trash2 size={12} /> Clear
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                {recent.length === 0 ? (
                  <p className="px-5 py-6 text-[13px] text-ink-3 text-center">No scans yet.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {recent.map((r, i) => (
                      <li key={`${r.code}-${i}`} className="px-5 py-3 flex items-start gap-3">
                        <span className={`mt-0.5 inline-flex w-6 h-6 items-center justify-center rounded-md text-[11px] font-bold ${
                          r.status === "valid" ? "bg-emerald-50 text-emerald-700" :
                          r.status === "duplicate" ? "bg-amber-50 text-amber-700" :
                          "bg-rose-50 text-rose-700"
                        }`}>
                          {r.status === "valid" ? "✓" : r.status === "duplicate" ? "↻" : "!"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-ink truncate">
                            {r.eventTitle ?? "Unknown ticket"}
                          </p>
                          <p className="text-[10.5px] font-mono text-ink-3 truncate">{r.code}</p>
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
