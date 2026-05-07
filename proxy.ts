import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "@/auth.config"

// Middleware runs on the Edge runtime — it must not transitively
// import lib/password (node:crypto) or other Node-only deps. We
// re-init NextAuth here with the Edge-safe authConfig only.
const { auth } = NextAuth(authConfig)

const protectedRoutes = ["/dashboard", "/organizer", "/account", "/orders", "/payouts", "/cart", "/checkout"]
const authRoutes = ["/auth/signin", "/auth/signup"]

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth

  const isProtected = protectedRoutes.some((r) => nextUrl.pathname.startsWith(r))
  const isAuthRoute = authRoutes.some((r) => nextUrl.pathname.startsWith(r))

  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL("/auth/signin", nextUrl))
  }

  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
