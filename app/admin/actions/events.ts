"use server"

import { revalidatePath } from "next/cache"
import { eq, and, inArray, or, sql } from "drizzle-orm"

import { auth, signIn } from "@/auth"
import { db } from "@/db"
import { events, orders, orderItems, paymentLedger, ticketTiers, tickets, users } from "@/db/schema"
import {
  sendEmail,
  adminEmail,
  sendOrderConfirmationEmail,
} from "@/lib/email"
import { eventPublishedNotificationEmail } from "@/lib/email-templates"
import { log } from "@/lib/logger"
import type { VelocityOrderMetadata } from "@/types/velocity"

export async function publishEventAction(eventId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const [ev] = await db
    .select({
      id: events.id,
      status: events.status,
      title: events.title,
      startsAt: events.startsAt,
      slug: events.slug,
      organizerId: events.organizerId,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)

  if (!ev) throw new Error("Event not found")

  const newStatus = ev.status === "published" ? "draft" : "published"

  await db
    .update(events)
    .set({ status: newStatus })
    .where(eq(events.id, eventId))

  // ── Notify organiser when their event is published ──────────────────────
  if (newStatus === "published") {
    const eventUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"}/events/${ev.slug}`
    const eventDate = ev.startsAt
      ? new Date(ev.startsAt).toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "TBA"

    // Notify the organiser
    try {
      const [org] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, ev.organizerId))
        .limit(1)

      if (org?.email) {
        const { html, text } = eventPublishedNotificationEmail({
          eventTitle: ev.title,
          eventDate,
          eventUrl,
          organizerName: org.name,
        })
        await sendEmail({
          to: org.email,
          subject: `🎉 ${ev.title} is now live`,
          html,
          text,
        })
      }
    } catch (err) {
      console.error("[publishEvent] failed to notify organiser:", err)
    }

    // Notify the admin
    try {
      const { html, text } = eventPublishedNotificationEmail({
        eventTitle: ev.title,
        eventDate,
        eventUrl,
        organizerName: session.user.name,
      })
      await sendEmail({
        to: adminEmail,
        subject: `🎉 ${ev.title} is now live`,
        html,
        text,
      })
    } catch (err) {
      console.error("[publishEvent] failed to notify admin:", err)
    }

    // WhatsApp alert to admin (fire-and-forget).
    try {
      const { sendAdminAlert } = await import("@/lib/whatsapp")
      const { eventPublishedAlert } = await import("@/lib/whatsapp-templates")
      await sendAdminAlert(eventPublishedAlert(ev.title, eventDate, eventUrl))
    } catch (err) {
      console.error("[publishEvent] failed to send admin WhatsApp alert:", err)
    }
  }

  revalidatePath("/admin/events")
  revalidatePath("/admin")
}

/**
 * Verify a user's email (set emailVerified to now).
 */
