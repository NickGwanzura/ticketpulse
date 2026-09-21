"use client"
import { SessionProvider } from "next-auth/react"
import { CartProvider } from "@/lib/cart-context"
import { ToastProvider } from "@/components/ui/Toast"
import ThemeSync from "@/components/layout/ThemeSync"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>
        <ToastProvider>
          <ThemeSync />
          {children}
        </ToastProvider>
      </CartProvider>
    </SessionProvider>
  )
}
