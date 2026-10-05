"use server"

import { revalidatePath } from "next/cache"
import { eq, sql } from "drizzle-orm"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth-guard"
import { recordAdminAction } from "@/lib/admin-audit"
import { db } from "@/db"
import { orders } from "@/db/schema"

export type SupportResult = { ok: boolean; error?: string }

const contactSchema = z.object({
  name: z.string().trim().max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  phone: z.string().trim().max(32),
})

/** Corrects the buyer's contact details so a resend reaches the right person. */
export async function updateOrderContactAction(
  orderId: string,
  input: { name: string; email: string; phone: string },
): Promise<SupportResult> {
  const session = await requireAdmin()

  const parsed = contactSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details" }
  const { name, email, phone } = parsed.data

  const [order] = await db
    .select({ guestEmail: orders.guestEmail, guestName: orders.guestName, guestPhone: orders.guestPhone })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)
  if (!order) return { ok: false, error: "Order not found" }

  await db
    .update(orders)
    .set({
      guestEmail: email,
      guestName: name || null,
      guestPhone: phone || null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))

  await recordAdminAction(session, {
    action: "order.contact_updated",
    targetType: "order",
    targetId: orderId,
    before: { email: order.guestEmail, name: order.guestName, phone: order.guestPhone },
    after: { email, name: name || null, phone: phone || null },
  })

  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath("/admin/orders")
  return { ok: true }
}

/** Appends an internal, staff-only note to an order (stored in order metadata). */
export async function addOrderNoteAction(orderId: string, text: string): Promise<SupportResult> {
  const session = await requireAdmin()

  const body = text.trim()
  if (!body) return { ok: false, error: "Write a note first" }
  if (body.length > 2000) return { ok: false, error: "Note is too long (2000 characters max)" }

  const note = {
    id: crypto.randomUUID(),
    text: body,
    by: session.user.email ?? session.user.id ?? "admin",
    at: new Date().toISOString(),
  }

  const updated = await db
    .update(orders)
    .set({
      metadata: sql`jsonb_set(
        coalesce(${orders.metadata}, '{}'::jsonb),
        '{supportNotes}',
        coalesce(${orders.metadata}->'supportNotes', '[]'::jsonb) || ${JSON.stringify([note])}::jsonb
      )`,
    })
    .where(eq(orders.id, orderId))
    .returning({ id: orders.id })
  if (updated.length === 0) return { ok: false, error: "Order not found" }

  revalidatePath(`/admin/orders/${orderId}`)
  return { ok: true }
}
