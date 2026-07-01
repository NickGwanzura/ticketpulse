import type { NextAuthConfig } from "next-auth"

// Edge-safe config consumed by middleware (proxy.ts). It must NOT
// import providers that pull in Node-only modules — Credentials is
// added in auth.ts because it depends on lib/password (node:crypto).
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
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
        token.emailVerified = user.emailVerified
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.role = token.role as string
        session.user.id = token.id as string
        session.user.emailVerified = token.emailVerified as unknown as string | null
      }
      return session
    },
  },
} satisfies NextAuthConfig
