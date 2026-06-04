"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"

export default function CopyReviewLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0 rounded-xl border border-line bg-paper-2 px-3.5 py-2.5">
        <p className="text-[13px] text-ink-2 truncate select-all">{url}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13px] font-semibold text-ink hover:bg-paper-2 transition-colors"
      >
        {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  )
}
