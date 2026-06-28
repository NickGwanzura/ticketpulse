import { NextResponse } from "next/server"
import { db } from "@/db"
import { events, users, ticketTiers } from "@/db/schema"
import { eq, sql } from "drizzle-orm"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: RouteParams) {
  const { id } = await ctx.params

  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      description: events.description,
      category: events.category,
      status: events.status,
      venue: events.venue,
      city: events.city,
      country: events.country,
      address: events.address,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      coverImage: events.coverImage,
      googleMapsUrl: events.googleMapsUrl,
      tags: events.tags,
      featured: events.featured,
      organizerId: events.organizerId,
      organizerName: users.name,
      organizerImage: users.image,
      faq: events.faq,
      promoImages: events.promoImages,
    })
    .from(events)
    .leftJoin(users, eq(events.organizerId, users.id))
    .where(eq(events.id, id))
    .limit(1)

  if (!event) {
    return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 })
  }

  const tiers = await db
    .select({
      id: ticketTiers.id,
      name: ticketTiers.name,
      description: ticketTiers.description,
      price: ticketTiers.price,
      currency: ticketTiers.currency,
      totalQuantity: ticketTiers.totalQuantity,
      soldQuantity: ticketTiers.soldQuantity,
      maxPerOrder: ticketTiers.maxPerOrder,
      earlyBirdPrice: ticketTiers.earlyBirdPrice,
      earlyBirdUntil: ticketTiers.earlyBirdUntil,
      groupPrice: ticketTiers.groupPrice,
      groupMinQty: ticketTiers.groupMinQty,
      salesStart: ticketTiers.salesStart,
      salesEnd: ticketTiers.salesEnd,
    })
    .from(ticketTiers)
    .where(eq(ticketTiers.eventId, id))
    .orderBy(ticketTiers.price)

  return NextResponse.json({
    ok: true,
    event: {
      ...event,
      tags: event.tags ?? [],
      promoImages: event.promoImages ?? [],
      tiers: tiers.map((t) => ({
        ...t,
        remaining: t.totalQuantity - (t.soldQuantity ?? 0),
        price: Number(t.price),
        earlyBirdPrice: t.earlyBirdPrice ? Number(t.earlyBirdPrice) : null,
        groupPrice: t.groupPrice ? Number(t.groupPrice) : null,
        salesStart: t.salesStart?.toISOString() ?? null,
        salesEnd: t.salesEnd?.toISOString() ?? null,
        earlyBirdUntil: t.earlyBirdUntil?.toISOString() ?? null,
      })),
    },
  })
}
