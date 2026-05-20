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
    // Preserve callbacks from auth.config.ts (jwt, session) and add signIn.
    ...authConfig.callbacks,
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

            // Notify the admin about the new signup (fire-and-forget).
            const { sendEmail, adminEmail } = await import("@/lib/email")
            const { newSignupAdminNotification } = await import("@/lib/email-templates")
            const notice = newSignupAdminNotification({
              name: user.name ?? null,
              email: user.email,
              role: (user as { role?: string }).role ?? "attendee",
            })
            sendEmail({
              to: adminEmail,
              subject: `New signup: ${user.email} (${(user as { role?: string }).role ?? "attendee"})`,
              html: notice.html,
              text: notice.text,
            }).catch((e) => console.error("[auth] admin signup notification", e))
          }
        } catch (e) {
          console.error("[auth] welcome email / admin notification", e)
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
    }
  }
  interface User {
    role?: string
  }
}
