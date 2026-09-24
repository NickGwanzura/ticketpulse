"use client"

import { useState } from "react"
import { formatDateShort } from "@/lib/utils"
import { QrCode, XCircle, CheckCircle, Clock, Download, Phone, Shield } from "lucide-react"
import { cancelStaffTicketAction } from "./actions"

type StaffTicket = {
  id: string
  staffName: string | null
  staffRole: string | null
  staffPhone: string | null
  qrCode: string | null
  status: string | null
  scannedAt: Date | null
  createdAt: Date | null
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case "available":
      return {
        label: "Active",
        cls: "bg-green-50 text-green-700",
        icon: CheckCircle,
      }
    case "used":
      return {
        label: "Used",
        cls: "bg-green-50 text-blue",
        icon: Clock,
      }
    case "cancelled":
      return {
        label: "Cancelled",
        cls: "bg-rose-50 text-rose-700",
        icon: XCircle,
      }
    default:
      return {
        label: status ?? "Unknown",
        cls: "bg-paper-2 text-ink-2 ring-1 ring-line",
        icon: Shield,
      }
  }
}

export default function StaffTicketList({
  eventId,
  tickets,
}: {
  eventId: string
  tickets: StaffTicket[]
}) {
  const [showQRMap, setShowQRMap] = useState<Set<string>>(new Set())

  const toggleQR = (id: string) => {
    setShowQRMap((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
              <th className="px-5 py-3 text-left">Staff name</th>
              <th className="px-3 py-3 text-left">Role</th>
              <th className="px-3 py-3 text-left">Phone</th>
              <th className="px-3 py-3 text-left">QR code</th>
              <th className="px-3 py-3 text-center">Status</th>
              <th className="px-3 py-3 text-left">Created</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {tickets.map((t) => {
              const badge = getStatusBadge(t.status)
              const BadgeIcon = badge.icon
              return (
                <tr key={t.id} className="hover:bg-paper-2 transition-colors">
                  <td className="px-5 py-3.5 text-[13px] font-medium text-ink">{t.staffName ?? "—"}</td>
                  <td className="px-3 py-3.5 text-[13px] text-ink-2">{t.staffRole ?? "—"}</td>
                  <td className="px-3 py-3.5 text-[13px] text-ink-2">
                    <span className="flex items-center gap-1">
                      <Phone size={11} className="text-ink-3" />
                      {t.staffPhone ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <button
                      type="button"
                      onClick={() => toggleQR(t.id)}
                      className="inline-flex items-center gap-1 text-[12px] font-mono text-navy hover:text-navy-700 transition"
                    >
                      <QrCode size={13} />
                      {showQRMap.has(t.id) ? t.qrCode ?? "N/A" : "Show QR"}
                    </button>
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
                      <BadgeIcon size={10} />
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-[12px] text-ink-3">
                    {(t.createdAt ? formatDateShort(t.createdAt) : "—")}
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    {t.status === "available" && (
                      <form action={cancelStaffTicketAction}>
                        <input type="hidden" name="ticketId" value={t.id} />
                        <input type="hidden" name="eventId" value={eventId} />
                        <button
                          type="submit"
                          onClick={(e) => {
                            if (!confirm(`Cancel ticket for ${t.staffName}?`)) {
                              e.preventDefault()
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-2 hover:text-rose-600 hover:border-rose-300 transition"
                        >
                          <XCircle size={11} /> Cancel
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-line">
        {tickets.map((t) => {
          const badge = getStatusBadge(t.status)
          const BadgeIcon = badge.icon
          return (
            <div key={t.id} className="px-5 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-ink">{t.staffName ?? "—"}</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                  <BadgeIcon size={9} />
                  {badge.label}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-2">
                <span>{t.staffRole ?? "—"}</span>
                <span className="flex items-center gap-1">
                  <Phone size={10} />
                  {t.staffPhone ?? "—"}
                </span>
                <span>{(t.createdAt ? formatDateShort(t.createdAt) : "—")}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleQR(t.id)}
                  className="inline-flex items-center gap-1 text-[11px] text-navy hover:text-navy-700 transition"
                >
                  <QrCode size={12} />
                  {showQRMap.has(t.id) ? t.qrCode ?? "N/A" : "Show QR"}
                </button>
                {t.status === "available" && (
                  <form action={cancelStaffTicketAction}>
                    <input type="hidden" name="ticketId" value={t.id} />
                    <input type="hidden" name="eventId" value={eventId} />
                    <button
                      type="submit"
                      onClick={(e) => {
                        if (!confirm(`Cancel ticket for ${t.staffName}?`)) {
                          e.preventDefault()
                        }
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 transition"
                    >
                      <XCircle size={11} /> Cancel
                    </button>
                  </form>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
