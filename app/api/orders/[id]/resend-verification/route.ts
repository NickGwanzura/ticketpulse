import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { signIn } from "@/auth"

type Params = { id: string }

const RESEND_COOLDOWN_MS = 60 * 1000 // 1 minute between resends per order

export async function POST(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 })

  if (order.status !== "awaiting_verification") {
    return NextResponse.json({ error: "already_finalized" }, { status: 409 })
  }
  if (!order.guestEmail) {
    return NextResponse.json({ error: "no_guest_email" }, { status: 400 })
  }
  if (
    order.verificationSentAt &&
    Date.now() - order.verificationSentAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    return NextResponse.json({ error: "cooldown" }, { status: 429 })
  }

  const origin = new URL(req.url).origin
  const finalizeUrl = `${origin}/api/orders/${id}/finalize`

  await signIn("resend", {
    email: order.guestEmail,
    redirectTo: finalizeUrl,
    redirect: false,
  })

  await db
    .update(orders)
    .set({ verificationSentAt: new Date(), updatedAt: new Date() })
    .where(eq(orders.id, id))

  return NextResponse.json({ ok: true, sentTo: order.guestEmail })
}
