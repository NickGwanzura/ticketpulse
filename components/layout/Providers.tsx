"use client"
import { SessionProvider } from "next-auth/react"
import { CartProvider } from "@/lib/cart-context"
import { ToastProvider } from "@/components/ui/Toast"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>
        <ToastProvider>{children}</ToastProvider>
      </CartProvider>
    </SessionProvider>
  )
}
