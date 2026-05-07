import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { shuttleRoutes, transportOperators, transportBookings } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { auth } from "@/auth"

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

  const body = await req.json()
  const { routeId, seats } = body

  const [route] = await db
    .select()
    .from(shuttleRoutes)
    .where(eq(shuttleRoutes.id, routeId))
    .limit(1)

  if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 })

  const available = route.totalSeats - (route.bookedSeats ?? 0)
  if (seats > available) {
    return NextResponse.json({ error: "Not enough seats available" }, { status: 400 })
  }

  const total = parseFloat(route.pricePerSeat) * seats

  const [booking] = await db
    .insert(transportBookings)
    .values({
      routeId,
      userId: session.user.id,
      seats,
      totalAmount: String(total),
      status: "pending",
    })
    .returning()

  await db
    .update(shuttleRoutes)
    .set({ bookedSeats: (route.bookedSeats ?? 0) + seats })
    .where(eq(shuttleRoutes.id, routeId))

  return NextResponse.json({ booking }, { status: 201 })
}
