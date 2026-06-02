"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"

interface QrCodeProps {
  value: string
  size?: number
  className?: string
}

export default function QrCode({ value, size = 160, className }: QrCodeProps) {
  const [generated, setGenerated] = useState<{ value: string; dataUrl: string } | null>(null)

  useEffect(() => {
    let cancelled = false

    if (value.startsWith("data:image")) {
      return
    }

    QRCode.toDataURL(value, { width: size, margin: 2 })
      .then((url) => {
        if (!cancelled) setGenerated({ value, dataUrl: url })
      })
      .catch(() => {
        if (!cancelled) setGenerated(null)
      })

    return () => {
      cancelled = true
    }
  }, [value, size])

  const dataUrl = value.startsWith("data:image")
    ? value
    : generated?.value === value
      ? generated.dataUrl
      : ""

  if (!dataUrl) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        aria-label="QR code loading"
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      width={size}
      height={size}
      className={className}
      alt="Ticket QR code"
    />
  )
}
