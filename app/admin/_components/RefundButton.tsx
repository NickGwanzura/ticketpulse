import Link from "next/link"
import { RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

export default function RefundButton({
  orderId,
  variant = "desktop",
}: {
  orderId: string
  variant?: "desktop" | "mobile" | "menu"
}) {
  return (
    <Link
      href={`/admin/orders/${orderId}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors",
        variant === "desktop"
          ? "px-2.5 py-1.5 text-[11px] text-rose-700 hover:bg-rose-50 border border-rose-200"
          : "px-3 py-2 text-[12px] text-rose-700 hover:bg-rose-50 border border-rose-200",
        variant === "menu" && "w-full justify-start",
      )}
      title="Review refund requests and provider-confirmed outcomes"
    >
      <RotateCcw size={variant === "desktop" ? 11 : 12} />
      Manage refunds
    </Link>
  )
}
