import type { NextAuthConfig } from "next-auth"

// Share the JWT session across ticketpulse.tech and its role subdomains in
// production. Keep localhost cookies host-only during local development.
const authCookieDomain =
  process.env.AUTH_COOKIE_DOMAIN?.trim() ||
  (process.env.NODE_ENV === "production" ? ".ticketpulse.tech" : undefined)

// Edge-safe config consumed by middleware (proxy.ts). It must NOT
// import providers that pull in Node-only modules — Credentials is
// added in auth.ts because it depends on lib/password (node:crypto).
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  cookies: authCookieDomain
    ? { sessionToken: { options: { domain: authCookieDomain } } }
    : undefined,
  pages: {
    signIn: "/auth/signin",
    newUser: "/auth/signup",
    error: "/auth/error",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.role = token.role as string
        session.user.id = token.id as string
      }
      return session
    },
  },
} satisfies NextAuthConfig
