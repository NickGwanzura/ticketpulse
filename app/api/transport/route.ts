import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { shuttleRoutes, transportOperators, transportBookings } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { auth } from "@/auth"
import { z } from "zod"

const PostSchema = z.object({
  routeId: z.uuid(),
  seats: z.int().positive().max(50),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get("eventId")

  if (!eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 })
  }

  const routes = await db
    .select({
      id: shuttleRoutes.id,
      vehicleType: shuttleRoutes.vehicleType,
      vehicleDescription: shuttleRoutes.vehicleDescription,
      departurePoint: shuttleRoutes.departurePoint,
      departureTime: shuttleRoutes.departureTime,
      returnTime: shuttleRoutes.returnTime,
      totalSeats: shuttleRoutes.totalSeats,
      bookedSeats: shuttleRoutes.bookedSeats,
      pricePerSeat: shuttleRoutes.pricePerSeat,
      currency: shuttleRoutes.currency,
      notes: shuttleRoutes.notes,
      operatorName: transportOperators.companyName,
      operatorVerified: transportOperators.verified,
      operatorRating: transportOperators.rating,
    })
    .from(shuttleRoutes)
    .leftJoin(transportOperators, eq(shuttleRoutes.operatorId, transportOperators.id))
    .where(and(eq(shuttleRoutes.eventId, eventId), eq(shuttleRoutes.active, true)))

  return NextResponse.json({ routes })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = PostSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }
  const { routeId, seats } = parsed.data

  try {
    const booking = await db.transaction(async (tx) => {
      const [route] = await tx
        .update(shuttleRoutes)
        .set({ bookedSeats: sql`${shuttleRoutes.bookedSeats} + ${seats}` })
        .where(and(
          eq(shuttleRoutes.id, routeId),
          sql`${shuttleRoutes.bookedSeats} + ${seats} <= ${shuttleRoutes.totalSeats}`
        ))
        .returning()

      if (!route) {
        throw new Error("NOT_ENOUGH_SEATS")
      }

      const total = parseFloat(route.pricePerSeat) * seats

      const [created] = await tx
        .insert(transportBookings)
        .values({
          routeId,
          userId: session.user.id,
          seats,
          totalAmount: String(total),
          status: "pending",
        })
        .returning()

      return created
    })

    return NextResponse.json({ booking }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_ENOUGH_SEATS") {
      return NextResponse.json({ error: "Not enough seats" }, { status: 409 })
    }
    throw err
  }
}
