import { notFound } from "next/navigation"
import { Calendar, MapPin, Users, Share2, Heart } from "lucide-react"
import MerchSection from "@/components/merch/MerchSection"
import TransportSection from "@/components/transport/TransportSection"
import VendorSection from "@/components/vendors/VendorSection"
import MediaSection from "@/components/media/MediaSection"
import TicketSelector from "@/components/events/TicketSelector"
import MobileBuyBar from "@/components/MobileBuyBar"
import { formatCurrency, formatDate } from "@/lib/utils"
import { auth } from "@/auth"

const MOCK_EVENT = {
  id: "nyuki-marathon-2026",
  slug: "nyuki-marathon-2026",
  title: "Nyuki Marathon 2026: One Bee, Million Futures",
  category: "Marathon",
  description: "Join thousands of runners at Zimbabwe's most celebrated marathon. The Nyuki Marathon 2026 brings together corporate teams, elite runners, and community participants for a morning of energy, purpose, and collective achievement. Every kilometer you run supports literacy programs across Zimbabwe.",
  venue: "National Sports Stadium",
  city: "Harare",
  country: "Zimbabwe",
  address: "Harare National Sports Stadium, Highfield, Harare",
  startsAt: new Date("2026-05-17T06:00:00"),
  organizer: { name: "Worker Bees Africa", image: null },
  tiers: [
    { id: "t1", name: "5km Fun Run", description: "Perfect for families and beginners", price: 3, currency: "USD", totalQuantity: 500, soldQuantity: 280, maxPerOrder: 10 },
    { id: "t2", name: "10km Standard", description: "Timed race with official certification", price: 5, currency: "USD", totalQuantity: 1000, soldQuantity: 650, maxPerOrder: 10 },
    { id: "t3", name: "21km Half Marathon", description: "Full competitive half marathon experience", price: 10, currency: "USD", totalQuantity: 300, soldQuantity: 290, maxPerOrder: 5 },
    { id: "t4", name: "Corporate Team (5 runners)", description: "Register your full team at a discounted rate", price: 20, currency: "USD", totalQuantity: 100, soldQuantity: 60, maxPerOrder: 3 },
  ],
  merch: [
    { id: "m1", eventId: "nyuki", name: "Official Race Tee", description: "Moisture-wicking finisher t-shirt", price: 8, currency: "USD", images: [], sizes: ["XS", "S", "M", "L", "XL", "XXL"], colors: ["White", "Green"], stockQuantity: 200, soldQuantity: 45, pickupAtEvent: true, deliveryAvailable: false },
    { id: "m2", eventId: "nyuki", name: "Nyuki Cap", description: "Breathable running cap with embroidered logo", price: 6, currency: "USD", images: [], sizes: [], colors: ["Black", "White"], stockQuantity: 150, soldQuantity: 30, pickupAtEvent: true, deliveryAvailable: true },
    { id: "m3", eventId: "nyuki", name: "Water Bottle", description: "BPA-free 750ml with Nyuki branding", price: 5, currency: "USD", images: [], sizes: [], colors: ["Green"], stockQuantity: 100, soldQuantity: 80, pickupAtEvent: true, deliveryAvailable: true },
    { id: "m4", eventId: "nyuki", name: "Finisher Medal Holder", description: "Engraved wooden medal display", price: 12, currency: "USD", images: [], sizes: [], colors: [], stockQuantity: 50, soldQuantity: 48, pickupAtEvent: false, deliveryAvailable: true },
  ],
  shuttles: [
    { id: "s1", eventId: "nyuki", operator: { companyName: "Mbare Express", verified: true, rating: 4.7 }, vehicleType: "bus" as const, vehicleDescription: "45-seater coach", departurePoint: "Mbare Musika Terminus", departureTime: new Date("2026-05-17T04:30:00"), returnTime: new Date("2026-05-17T12:00:00"), totalSeats: 45, bookedSeats: 22, pricePerSeat: 2, currency: "USD" },
    { id: "s2", eventId: "nyuki", operator: { companyName: "Avondale Rides", verified: true, rating: 4.5 }, vehicleType: "kombi" as const, vehicleDescription: "15-seater kombi", departurePoint: "Avondale Shopping Centre", departureTime: new Date("2026-05-17T05:00:00"), returnTime: new Date("2026-05-17T12:30:00"), totalSeats: 15, bookedSeats: 13, pricePerSeat: 1.5, currency: "USD" },
    { id: "s3", eventId: "nyuki", operator: { companyName: "CBD Shuttles", verified: false, rating: 4.1 }, vehicleType: "bus" as const, vehicleDescription: "30-seater bus", departurePoint: "Harare CBD — Joina City", departureTime: new Date("2026-05-17T04:45:00"), returnTime: new Date("2026-05-17T12:00:00"), totalSeats: 30, bookedSeats: 30, pricePerSeat: 2, currency: "USD" },
  ],
  vendors: [
    { id: "v1", eventId: "nyuki", vendor: { businessName: "Mama's Kitchen", category: "catering" as const, logo: null, verified: true, rating: 4.8 }, packageName: "Full breakfast buffet", packageDescription: "Continental and local breakfast for up to 200 guests. Includes sadza, eggs, toast, juice, and tea.", price: 800, currency: "USD", available: true, booked: false },
    { id: "v2", eventId: "nyuki", vendor: { businessName: "Zviyo Bar", category: "bar" as const, logo: null, verified: false, rating: 4.2 }, packageName: "Post-race refreshment bar", packageDescription: "Full bar service with water, sports drinks, Chibuku, and craft beer. Equipment included.", price: 500, currency: "USD", available: true, booked: false },
    { id: "v3", eventId: "nyuki", vendor: { businessName: "Lens & Light Photography", category: "photography" as const, logo: null, verified: true, rating: 4.9 }, packageName: "Official event photography", packageDescription: "2 photographers covering the full event. All photos delivered via TicketPulse gallery within 48 hours.", price: 600, currency: "USD", available: false, booked: true },
  ],
  galleries: [
    { id: "g1", eventId: "nyuki", name: "Nyuki 2025 Highlights", description: "Photos from last year's edition", coverImage: null, photoCount: 0, packPrice: 3, currency: "USD", isPublic: true, photos: [] },
  ],
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await params
  const session = await auth()
  const isOrganizer = session?.user.role === "organizer"

  if (!MOCK_EVENT) notFound()
  const e = MOCK_EVENT

  return (
    <div>
      <div className="relative h-72 md:h-80 bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="absolute inset-0 [background:radial-gradient(800px_circle_at_30%_20%,rgba(255,255,255,0.7),transparent_60%)] pointer-events-none" />
        <span className="text-8xl relative">🏃</span>
        <div className="absolute top-5 right-5 flex gap-2">
          <button className="border border-line bg-paper/80 backdrop-blur text-ink-2 rounded-lg p-2.5 hover:text-ink hover:border-line-2 transition-colors">
            <Share2 size={16} />
          </button>
          <button className="border border-line bg-paper/80 backdrop-blur text-ink-2 rounded-lg p-2.5 hover:text-rose-600 hover:border-line-2 transition-colors">
            <Heart size={16} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-8 pt-10 pb-28 lg:pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-12">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">{e.category}</p>
              <h1 className="text-[28px] md:text-[40px] font-bold tracking-tight leading-tight text-ink mb-5">{e.title}</h1>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-ink-2 mb-6">
                <span className="flex items-center gap-2"><Calendar size={14} className="text-ink-3" />{formatDate(e.startsAt)}</span>
                <span className="flex items-center gap-2"><MapPin size={14} className="text-ink-3" />{e.venue}, {e.city}</span>
                <span className="flex items-center gap-2"><Users size={14} className="text-ink-3" />Organized by {e.organizer.name}</span>
              </div>
              <p className="text-ink-2 leading-relaxed text-[15px]">{e.description}</p>
            </div>

            <MerchSection items={e.merch} eventTitle={e.title} />
            <TransportSection routes={e.shuttles} />
            <VendorSection listings={e.vendors} isOrganizer={isOrganizer} />
            <MediaSection galleries={e.galleries} eventTitle={e.title} />
          </div>

          <div className="lg:col-span-1">
            <TicketSelector
              eventSlug={e.slug}
              eventTitle={e.title}
              emoji="🏃"
              tiers={e.tiers}
            />
          </div>
        </div>
      </div>

      <MobileBuyBar
        label="Buy tickets"
        primary={`${formatCurrency(Math.min(...e.tiers.map((t) => t.price)), e.tiers[0].currency)}`}
        secondary="From"
        href="#tickets"
      />
    </div>
  )
}
