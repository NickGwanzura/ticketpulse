import NextAuth from "next-auth"
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server"
import { authConfig } from "@/auth.config"
import { isMaintenanceOn, maintenanceHtml, maintenanceUntil } from "@/lib/maintenance"

// Middleware runs on the Edge runtime — it must not transitively
// import lib/password (node:crypto) or other Node-only deps.
const { auth } = NextAuth(authConfig)

const protectedRoutes = ["/dashboard", "/organizer", "/admin", "/account", "/payouts"]
const authRoutes = ["/auth/signin", "/auth/signup"]
const ACCESS_COOKIE = "tp_access"
const ROLE_HOSTS = {
  organizer: "organizer.ticketpulse.tech",
  admin: "admin.ticketpulse.tech",
} as const
const APP_HOSTS = new Set(["ticketpulse.tech", "www.ticketpulse.tech", ...Object.values(ROLE_HOSTS)])

function isLocalPath(value: string | null): value is string {
  return !!value && value.startsWith("/") && !value.startsWith("//")
}

function roleHostForPath(path: string): string | null {
  if (path === "/admin" || path.startsWith("/admin/")) return ROLE_HOSTS.admin
  if (path === "/organizer" || path.startsWith("/organizer/")) return ROLE_HOSTS.organizer
  return null
}

function roleLandingPath(role: string | null | undefined, requestedPath: string): string | null {
  if (role !== "organizer" && role !== "admin") return null
  if (requestedPath === "/" || requestedPath === "/dashboard") {
    return role === "admin" ? "/admin" : "/organizer"
  }
  if (role === "admin" && requestedPath.startsWith("/admin")) return requestedPath
  if (role === "organizer" && requestedPath.startsWith("/organizer")) return requestedPath
  return role === "admin" ? "/admin" : "/organizer"
}

function roleHostRedirect(
  nextUrl: URL,
  role: string | null | undefined,
  requestedPath: string,
): NextResponse | null {
  if (!APP_HOSTS.has(nextUrl.hostname)) return null
  const targetHost = role === "organizer" || role === "admin" ? ROLE_HOSTS[role] : null
  const destinationPath = roleLandingPath(role, requestedPath)
  if (!targetHost || !destinationPath) return null

  const isRoleArea = requestedPath === "/" || requestedPath === "/dashboard" || requestedPath.startsWith("/organizer") || requestedPath.startsWith("/admin")
  if (!isRoleArea) return null
  if (nextUrl.hostname === targetHost && nextUrl.pathname === destinationPath) return null

  const destination = new URL(destinationPath, `https://${targetHost}`)
  destination.search = nextUrl.search
  return NextResponse.redirect(destination)
}

const authProxy = auth((req) => {
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
    // Auth.js can normalize the request URL from deployment environment
    // settings. Build role-area sign-in URLs from the canonical host so an
    // admin or organizer never falls back to the public site during login.
    const roleHost = roleHostForPath(path)
    const signInUrl = roleHost
      ? new URL("/auth/signin", `https://${roleHost}`)
      : new URL("/auth/signin", nextUrl)
    signInUrl.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`)
    return NextResponse.redirect(signInUrl)
  }

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && isLoggedIn) {
    const callbackUrl = nextUrl.searchParams.get("callbackUrl")
    if (isLocalPath(callbackUrl)) {
      const roleRedirect = roleHostRedirect(nextUrl, req.auth?.user?.role, callbackUrl)
      if (roleRedirect) return roleRedirect
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

    const roleRedirect = roleHostRedirect(nextUrl, req.auth?.user?.role, "/dashboard")
    if (roleRedirect) return roleRedirect
    return NextResponse.redirect(new URL("/dashboard", nextUrl))
  }

  const roleRedirect = roleHostRedirect(nextUrl, req.auth?.user?.role, path)
  if (roleRedirect) return roleRedirect

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-pathname", path)
  return NextResponse.next({ request: { headers: requestHeaders } })
})

/** Paths the auth layer never handled: API routes and static assets. */
const SKIP_AUTH = /^\/(?:api\/|_next\/static|_next\/image|favicon\.ico|images\/|fonts\/)|\.svg$/

/**
 * Maintenance runs before anything else, on pages AND API routes, so nobody can
 * sign in, open a dashboard or start a checkout while the site is closed.
 * Only /api/health stays open so the host can tell whether the database is back.
 */
export default function proxy(req: NextRequest, event: NextFetchEvent) {
  const path = req.nextUrl.pathname

  if (isMaintenanceOn() && path !== "/api/health") {
    const until = maintenanceUntil()
    const retryAfter = String(Math.max(300, Math.round((until.getTime() - Date.now()) / 1000)))
    if (path.startsWith("/api/")) {
      return NextResponse.json(
        { error: "TicketPulse is closed for urgent maintenance. Please try again later.", code: "maintenance", until: until.toISOString() },
        { status: 503, headers: { "Retry-After": retryAfter, "Cache-Control": "no-store" } },
      )
    }
    return new NextResponse(maintenanceHtml(until), {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": retryAfter,
        "X-Robots-Tag": "noindex",
      },
    })
  }

  // Outside maintenance, keep the original behaviour: API calls and static
  // files skip the auth layer entirely (it used to be excluded by the matcher).
  if (SKIP_AUTH.test(path)) return NextResponse.next()
  return (authProxy as unknown as (req: NextRequest, event: NextFetchEvent) => ReturnType<typeof NextResponse.next>)(req, event)
}

export const config = {
  // Every request except build assets and public static files. API routes are
  // included so maintenance can close them; proxy() skips auth for them.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|fonts/|.*\\.svg$).*)",
  ],
}
