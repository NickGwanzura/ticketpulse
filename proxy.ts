import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "@/auth.config"

// Middleware runs on the Edge runtime — it must not transitively
// import lib/password (node:crypto) or other Node-only deps. We
// re-init NextAuth here with the Edge-safe authConfig only.
const { auth } = NextAuth(authConfig)

// NOTE: /orders, /cart, /checkout are intentionally NOT protected.
// Order pages are accessed by UUID (128-bit random — unguessable).
// Cart and checkout are guest-friendly flows that must not require auth.
const protectedRoutes = ["/dashboard", "/organizer", "/account", "/payouts"]
const authRoutes = ["/auth/signin", "/auth/signup"]
const ACCESS_COOKIE = "tp_access"

export default auth((req) => {
  const { nextUrl } = req
  const path = nextUrl.pathname

  const isApi = path.startsWith("/api/")
  const isAuthApi = path.startsWith("/api/auth/")

  if (process.env.LAUNCH_GATE_ENABLED === "true") {
    const hasAccess = req.cookies.get(ACCESS_COOKIE)?.value === "ok"
    const isComingSoon = path === "/coming-soon" || path.startsWith("/coming-soon/")
    if (!hasAccess && !isComingSoon && !isAuthApi) {
      if (isApi) {
        return NextResponse.json({ error: "not found" }, { status: 404 })
      }
      return NextResponse.redirect(new URL("/coming-soon", nextUrl))
    }
  }

  if (isApi) {
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set("x-pathname", path)
    return NextResponse.next({ request: { headers: requestHeaders } })
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

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-pathname", path)
  return NextResponse.next({ request: { headers: requestHeaders } })
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
