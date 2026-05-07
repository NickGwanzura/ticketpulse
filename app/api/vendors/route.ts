import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { vendors, vendorListings } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { auth } from "@/auth"
import { z } from "zod"

const VENDOR_CATS = ["catering", "bar", "food_truck", "photography", "sound", "security", "decor", "other"] as const
type VendorCat = typeof VENDOR_CATS[number]

const PostSchema = z.object({
  listingId: z.uuid(),
  eventId: z.uuid().optional(),
})

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

  const conditions = category && (VENDOR_CATS as readonly string[]).includes(category)
    ? [eq(vendors.category, category as VendorCat)]
    : []
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

  const parsed = PostSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 })
  }
  const { listingId } = parsed.data

  const [listing] = await db
    .update(vendorListings)
    .set({
      booked: true,
      available: false,
      bookedById: session.user.id,
      bookedAt: new Date(),
    })
    .where(and(
      eq(vendorListings.id, listingId),
      eq(vendorListings.available, true),
      eq(vendorListings.booked, false),
    ))
    .returning()

  if (!listing) {
    return NextResponse.json({ error: "Listing not found or already booked" }, { status: 404 })
  }

  return NextResponse.json({ listing })
}
