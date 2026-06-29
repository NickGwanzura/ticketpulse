import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "@/auth.config"

// Middleware runs on the Edge runtime — it must not transitively
// import lib/password (node:crypto) or other Node-only deps.
const { auth } = NextAuth(authConfig)

const protectedRoutes = ["/dashboard", "/organizer", "/account", "/payouts"]
const authRoutes = ["/auth/signin", "/auth/signup"]
const ACCESS_COOKIE = "tp_access"

function isLocalPath(value: string | null): value is string {
  return !!value && value.startsWith("/") && !value.startsWith("//")
}

export default auth((req) => {
  const { nextUrl } = req
  const path = nextUrl.pathname

  const isApi = path.startsWith("/api/")
  const isAuthApi = path.startsWith("/api/auth/")

  // Launch gate — redirect to /coming-soon when enabled
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

  // API routes — just forward with pathname header
  if (isApi) {
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set("x-pathname", path)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  const isLoggedIn = !!req.auth
  const isProtected = protectedRoutes.some((r) => path.startsWith(r))
  const isAuthRoute = authRoutes.some((r) => path.startsWith(r))

  // Redirect unauthenticated users to sign-in
  if (isProtected && !isLoggedIn) {
    const signInUrl = new URL("/auth/signin", nextUrl)
    signInUrl.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`)
    return NextResponse.redirect(signInUrl)
  }

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && isLoggedIn) {
    const callbackUrl = nextUrl.searchParams.get("callbackUrl")
    if (isLocalPath(callbackUrl)) {
      return NextResponse.redirect(new URL(callbackUrl, nextUrl))
    }

    if (path.startsWith("/auth/signup")) {
      const role = nextUrl.searchParams.get("role")
      if (role === "organizer" || role === "vendor") {
        const completeUrl = new URL("/auth/complete-signup", nextUrl)
        completeUrl.searchParams.set("role", role)
        return NextResponse.redirect(completeUrl)
      }
    }

    return NextResponse.redirect(new URL("/dashboard", nextUrl))
  }

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-pathname", path)
  return NextResponse.next({ request: { headers: requestHeaders } })
})

export const config = {
  // Only run on page routes, not on API calls or static assets.
  // API calls handle their own auth. This prevents auth-middleware
  // redirects from interrupting API requests made by the client,
  // which was causing "page keeps refreshing" when organizers filled
  // out the event creation form (geocode AI calls, etc.).
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|images/|fonts/|.*\\.svg$).*)",
  ],
}
