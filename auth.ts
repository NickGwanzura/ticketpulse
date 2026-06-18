import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Resend from "next-auth/providers/resend"
import Credentials from "next-auth/providers/credentials"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/db/schema"
import { verifyPassword } from "@/lib/password"
import { log } from "@/lib/logger"
import { authConfig } from "@/auth.config"
import {
  sendMagicLinkEmail,
  sendPurchaseVerificationEmail,
  sendWelcomeEmail,
} from "@/lib/email"
import { orders, events } from "@/db/schema"

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
  ...authConfig,
  adapter,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id
        token.approvedAt = user.approvedAt
        return token
      }

      if (token.id && process.env.DATABASE_URL) {
        try {
          const [row] = await db
            .select({ role: users.role, approvedAt: users.approvedAt })
            .from(users)
            .where(eq(users.id, token.id as string))
            .limit(1)
          if (row?.role) token.role = row.role
          token.approvedAt = row?.approvedAt?.toISOString() ?? null
        } catch (err) {
          console.error("[auth] refresh token role", err)
          log.error("auth — refresh token role failed", { error: err instanceof Error ? err.message : String(err) })
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.role = token.role as string
        session.user.id = token.id as string
        session.user.approvedAt = token.approvedAt as string | null | undefined
      }
      return session
    },
    async signIn({ user, account }) {
      // Send a welcome email when a user signs up via an OAuth or email
      // provider (Google, magic link).  Credentials signups are handled
      // directly in the server action (app/auth/signup/page.tsx).
      if (
        account &&
        account.provider !== "credentials" &&
        user.email
      ) {
        try {
          const [row] = await db
            .select({ createdAt: users.createdAt })
            .from(users)
            .where(eq(users.email, user.email))
            .limit(1)

          // If the user row was created in the last 60 seconds this is a
          // brand-new signup, not a returning user signing in again.
          if (
            row?.createdAt &&
            Date.now() - new Date(row.createdAt).getTime() < 60_000
          ) {
            await sendWelcomeEmail({ to: user.email, name: user.name })

            const role = (user as { role?: string }).role ?? "attendee"

            // Notify the admin about the new signup (fire-and-forget).
            const { sendEmail, adminEmail } = await import("@/lib/email")
            const { newSignupAdminNotification } = await import("@/lib/email-templates")
            const notice = newSignupAdminNotification({
              name: user.name ?? null,
              email: user.email,
              role,
            })
            sendEmail({
              to: adminEmail,
              subject: `New signup: ${user.email} (${role})`,
              html: notice.html,
              text: notice.text,
            }).catch((e) => {
              console.error("[auth] admin signup notification", e)
              log.error("auth — admin signup notification failed", { error: String(e) })
            })

            // WhatsApp alert to admin (fire-and-forget).
            const { sendAdminAlert } = await import("@/lib/whatsapp")
            const { newSignupAlert } = await import("@/lib/whatsapp-templates")
            sendAdminAlert(
              newSignupAlert(user.name ?? "—", user.email, role),
            ).catch((e) => {
              console.error("[auth] admin signup WhatsApp alert", e)
              log.error("auth — admin signup WhatsApp alert failed", { error: String(e) })
            })
          }
        } catch (e) {
          console.error("[auth] welcome email / admin notification", e)
          log.error("auth — welcome email / admin notification failed", { error: String(e) })
          // Sign-in must not fail if the email send fails.
        }
      }
      return true
    },
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: "TicketPulse <no-reply@ticketpulse.tech>",
      async sendVerificationRequest({ identifier: email, url }) {
        // ── Fix the magic-link URL ────────────────────────────────────────
        // NextAuth constructs the URL from AUTH_URL (or request headers). If
        // AUTH_URL isn't set or is wrong (e.g. localhost), the email link will
        // point to the wrong host. We override the origin with the public URL.
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech").replace(/\/+$/, "")
        const parsed = new URL(url)
        if (parsed.origin !== appUrl) {
          url = url.replace(parsed.origin, appUrl)
        }
        const host = new URL(url).host

        // Inspect the embedded callbackUrl to decide which branded template
        // to send. Guest-checkout flows route the magic link through
        // `/api/orders/<id>/finalize`, so swap to the purchase template and
        // pull order context for the email body.
        const callback = new URL(url).searchParams.get("callbackUrl") ?? ""
        const finalizeMatch = callback.match(/\/api\/orders\/([0-9a-fA-F-]+)\/finalize/)

        if (finalizeMatch && process.env.DATABASE_URL) {
          const orderId = finalizeMatch[1]
          const [row] = await db
            .select({
              total: orders.totalAmount,
              currency: orders.currency,
              eventTitle: events.title,
            })
            .from(orders)
            .leftJoin(events, eq(events.id, orders.eventId))
            .where(eq(orders.id, orderId))
            .limit(1)

          if (row) {
            await sendPurchaseVerificationEmail({
              to: email,
              url,
              eventTitle: row.eventTitle ?? "your event",
              amount: row.total,
              currency: row.currency ?? "USD",
            })
            return
          }
        }

        await sendMagicLinkEmail({ to: email, url, host })
      },
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email    = (credentials?.email    as string | undefined)?.toLowerCase().trim()
        const password = (credentials?.password as string | undefined) ?? ""
        if (!email || !password) return null
        if (!process.env.DATABASE_URL) return null

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
        if (!user || !user.passwordHash) return null
        if (!verifyPassword(password, user.passwordHash)) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role ?? "attendee",
        }
      },
    }),
  ],
})

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      name?: string | null
      email?: string | null
      image?: string | null
      approvedAt?: string | null
    }
  }
  interface User {
    role?: string
    approvedAt?: string | null
  }
}
