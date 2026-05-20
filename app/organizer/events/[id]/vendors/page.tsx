import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { eq, asc } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft, Store, ShoppingBag } from "lucide-react"

import { db } from "@/db"
import { events, vendors, vendorListings } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import AddVendorPanel from "./AddVendorPanel"
import VendorListingCard from "./VendorListingCard"

export const metadata = {
  title: "Vendors",
}

type RouteParams = { id: string }

export default async function VendorsPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { id } = await params

  const session = await auth()
  if (!session) redirect(`/auth/signin?callbackUrl=/organizer/events/${id}/vendors`)

  const [event] = await db
    .select({ id: events.id, title: events.title, organizerId: events.organizerId })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)
  if (!event) notFound()
  if (event.organizerId !== session.user.id && session.user.role !== "admin") {
    redirect("/organizer")
  }

  // Fetch existing vendor listings for this event (joined with vendor info)
  const listings = await db
    .select({
      id: vendorListings.id,
      eventId: vendorListings.eventId,
      vendorId: vendorListings.vendorId,
      packageName: vendorListings.packageName,
      packageDescription: vendorListings.packageDescription,
      price: vendorListings.price,
      currency: vendorListings.currency,
      maxCapacity: vendorListings.maxCapacity,
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
    .where(eq(vendorListings.eventId, id))
    .orderBy(asc(vendorListings.createdAt))

  // Fetch all marketplace vendors for the "add new" panel
  const marketplaceVendors = await db
    .select({
      id: vendors.id,
      businessName: vendors.businessName,
      category: vendors.category,
      logo: vendors.logo,
      verified: vendors.verified,
      rating: vendors.rating,
      city: vendors.city,
    })
    .from(vendors)
    .orderBy(asc(vendors.businessName))

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title={`Vendors: ${event.title}`}
        subtitle="Browse marketplace vendors and add them as optional add-ons for ticket buyers."
      />

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-6">
        <Link
          href={`/organizer/events/${id}/edit`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink"
        >
          <ArrowLeft size={13} /> Back to event
        </Link>

        <AddVendorPanel eventId={id} vendors={marketplaceVendors} />

        {listings.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No vendors yet"
            body="Add vendors from the marketplace above. Ticket buyers can purchase their services as optional add-ons alongside tickets."
            variant="card"
          />
        ) : (
          <div className="space-y-4">
            {listings.map((l) => (
              <VendorListingCard
                key={l.id}
                eventId={id}
                listing={{
                  id: l.id,
                  vendorId: l.vendorId,
                  packageName: l.packageName,
                  packageDescription: l.packageDescription,
                  price: l.price,
                  currency: l.currency ?? "USD",
                  maxCapacity: l.maxCapacity,
                  available: l.available ?? true,
                  booked: l.booked ?? false,
                  vendor: {
                    businessName: l.businessName ?? "Unknown vendor",
                    category: (l.category ?? "other") as "catering" | "bar" | "food_truck" | "photography" | "sound" | "security" | "decor" | "other",
                    logo: l.logo,
                    verified: l.verified ?? false,
                    rating: l.rating ? Number.parseFloat(l.rating) : null,
                  },
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
