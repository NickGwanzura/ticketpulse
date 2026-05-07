import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { vendors, vendorListings } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { auth } from "@/auth"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get("eventId")
  const category = searchParams.get("category")

  if (eventId) {
    const listings = await db
      .select({
        id: vendorListings.id,
        packageName: vendorListings.packageName,
        packageDescription: vendorListings.packageDescription,
        price: vendorListings.price,
        currency: vendorListings.currency,
        available: vendorListings.available,
        booked: vendorListings.booked,
        businessName: vendors.businessName,
        category: vendors.category,
        logo: vendors.logo,
        verified: vendors.verified,
        rating: vendors.rating,
      })
      .from(vendorListings)
      .leftJoin(vendors, eq(vendorListings.vendorId, vendors.id))
      .where(eq(vendorListings.eventId, eventId))

    return NextResponse.json({ listings })
  }

  const conditions = category ? [eq(vendors.category, category as any)] : []
  const allVendors = await db
    .select()
    .from(vendors)
    .where(conditions.length ? and(...conditions) : undefined)

  return NextResponse.json({ vendors: allVendors })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { listingId, eventId } = body

  const [listing] = await db
    .select()
    .from(vendorListings)
    .where(and(eq(vendorListings.id, listingId), eq(vendorListings.available, true)))
    .limit(1)

  if (!listing) return NextResponse.json({ error: "Listing not found or unavailable" }, { status: 404 })
  if (listing.booked) return NextResponse.json({ error: "Already booked" }, { status: 400 })

  const [updated] = await db
    .update(vendorListings)
    .set({
      booked: true,
      available: false,
      bookedById: session.user.id,
      bookedAt: new Date(),
    })
    .where(eq(vendorListings.id, listingId))
    .returning()

  return NextResponse.json({ listing: updated })
}
