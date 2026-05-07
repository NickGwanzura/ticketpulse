import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "@/auth.config"

// Middleware runs on the Edge runtime — it must not transitively
// import lib/password (node:crypto) or other Node-only deps. We
// re-init NextAuth here with the Edge-safe authConfig only.
const { auth } = NextAuth(authConfig)

const protectedRoutes = ["/dashboard", "/organizer", "/account", "/orders", "/payouts", "/cart", "/checkout"]
const authRoutes = ["/auth/signin", "/auth/signup"]
const ACCESS_COOKIE = "tp_access"

export default auth((req) => {
  const { nextUrl } = req
  const path = nextUrl.pathname

  if (process.env.LAUNCH_GATE_ENABLED === "true") {
    const hasAccess = req.cookies.get(ACCESS_COOKIE)?.value === "ok"
    const isComingSoon = path === "/coming-soon" || path.startsWith("/coming-soon/")
    if (!hasAccess && !isComingSoon) {
      return NextResponse.redirect(new URL("/coming-soon", nextUrl))
    }
  }

  const isLoggedIn = !!req.auth
  const isProtected = protectedRoutes.some((r) => path.startsWith(r))
  const isAuthRoute = authRoutes.some((r) => path.startsWith(r))

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
