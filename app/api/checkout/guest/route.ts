import { NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { events, orders, orderItems, ticketTiers } from "@/db/schema"
import { signIn } from "@/auth"

const Body = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().min(1).max(120).trim(),
  phone: z.string().min(3).max(40).trim(),
  paymentMethod: z.enum(["ecocash", "card", "paynow", "usd"]),
  eventSlug: z.string().min(1).max(160),
  items: z
    .array(
      z.object({
        tierId: z.string().uuid(),
        quantity: z.number().int().positive().max(50),
      }),
    )
    .min(1)
    .max(20),
})

const VERIFICATION_TTL_HOURS = 24

export async function POST(req: Request) {
  let parsed: z.infer<typeof Body>
  try {
    parsed = Body.parse(await req.json())
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request", detail: err instanceof Error ? err.message : null },
      { status: 400 },
    )
  }

  const [event] = await db.select().from(events).where(eq(events.slug, parsed.eventSlug)).limit(1)
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

  // Pull tier prices server-side so the client can't dictate amounts.
  const tiers = await db
    .select()
    .from(ticketTiers)
    .where(eq(ticketTiers.eventId, event.id))

  const byId = new Map(tiers.map((t) => [t.id, t]))
  for (const item of parsed.items) {
    if (!byId.has(item.tierId)) {
      return NextResponse.json({ error: "Tier not in event" }, { status: 400 })
    }
  }

  // Compute total. Mixed currencies aren't supported in v1 — bail early.
  const currencies = new Set(parsed.items.map((i) => byId.get(i.tierId)!.currency ?? "USD"))
  if (currencies.size > 1) {
    return NextResponse.json({ error: "Mixed-currency cart not supported yet" }, { status: 400 })
  }
  const currency = [...currencies][0] ?? "USD"
  const total = parsed.items.reduce((sum, i) => {
    const t = byId.get(i.tierId)!
    return sum + Number(t.price) * i.quantity
  }, 0)

  // TODO: integrate real payment capture here (EcoCash / Paynow / Visa).
  // For now we trust the client's selection and mark the funds as captured.
  // The order stays `awaiting_verification` until the buyer clicks the link.
  const paidAt = new Date()
  const expires = new Date(Date.now() + VERIFICATION_TTL_HOURS * 60 * 60 * 1000)

  const [order] = await db
    .insert(orders)
    .values({
      userId: null,
      eventId: event.id,
      status: "awaiting_verification",
      totalAmount: total.toFixed(2),
      currency,
      paymentMethod: parsed.paymentMethod,
      paidAt,
      guestEmail: parsed.email,
      guestName: parsed.name,
      guestPhone: parsed.phone,
      verificationSentAt: new Date(),
      verificationExpires: expires,
    })
    .returning({ id: orders.id })

  await db.insert(orderItems).values(
    parsed.items.map((i) => {
      const t = byId.get(i.tierId)!
      const unit = Number(t.price)
      return {
        orderId: order.id,
        tierId: i.tierId,
        type: "ticket",
        quantity: i.quantity,
        unitPrice: unit.toFixed(2),
        total: (unit * i.quantity).toFixed(2),
      }
    }),
  )

  // Trigger NextAuth's Resend provider — this writes the verification token
  // to the DB and fires our `sendVerificationRequest` override, which detects
  // the finalize callback and uses the branded purchase-verification template.
  const origin = new URL(req.url).origin
  const finalizeUrl = `${origin}/api/orders/${order.id}/finalize`

  await signIn("resend", {
    email: parsed.email,
    redirectTo: finalizeUrl,
    redirect: false,
  })

  return NextResponse.json({
    orderId: order.id,
    status: "awaiting_verification",
    sentTo: parsed.email,
    expiresAt: expires.toISOString(),
  })
}
