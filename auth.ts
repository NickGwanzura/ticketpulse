import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Resend from "next-auth/providers/resend"
import Credentials from "next-auth/providers/credentials"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/db"
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/db/schema"

// DrizzleAdapter introspects `db` at construction time, so we only
// build it when DATABASE_URL is available. With JWT-strategy sessions
// the adapter is optional anyway; skip it during build / demo runs.
const adapter = process.env.DATABASE_URL
  ? DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    })
  : undefined

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
    newUser: "/auth/signup",
    error: "/auth/error",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: "TicketPulse <no-reply@ticketpulse.co.zw>",
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
        name:     { label: "Name",     type: "text" },
      },
      async authorize(credentials) {
        const email    = (credentials?.email    as string | undefined)?.toLowerCase().trim()
        const password = (credentials?.password as string | undefined) ?? ""
        const name     = (credentials?.name     as string | undefined)?.trim() || null
        if (!email || !password) return null

        const DEMO: Record<string, { role: "attendee" | "organizer" | "vendor" | "admin"; name: string }> = {
          "demo@ticketpulse.zw":      { role: "attendee",  name: "Demo Attendee" },
          "organizer@ticketpulse.zw": { role: "organizer", name: "Demo Organizer" },
          "vendor@ticketpulse.zw":    { role: "vendor",    name: "Demo Vendor" },
          "admin@ticketpulse.zw":     { role: "admin",     name: "Demo Admin" },
        }
        const demo = DEMO[email]
        if (demo) {
          if (password !== "demo1234") return null
          return { id: `demo-${email}`, email, name: demo.name, role: demo.role }
        }

        // Demo-mode fallback: any email + password ≥ 6 chars creates a synthetic attendee session.
        if (password.length < 6) return null
        return {
          id: `demo-${email}`,
          email,
          name: name ?? email.split("@")[0],
          role: "attendee",
        }
      },
    }),
  ],
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
})

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
  interface User {
    role?: string
  }
}
