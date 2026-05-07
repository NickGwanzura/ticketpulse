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
  description: "Join runners at Zimbabwe's Nyuki Marathon 2026. The event brings together corporate teams, elite runners, and community participants for a morning of energy, purpose, and collective achievement. Every kilometer you run supports literacy programs across Zimbabwe.",
  venue: "National Sports Stadium",
  city: "Harare",
  country: "Zimbabwe",
  address: "Harare National Sports Stadium, Highfield, Harare",
  startsAt: new Date("2026-05-17T06:00:00"),
  organizer: { name: "Worker Bees Africa", image: null },
  tiers: [
    { id: "t1", name: "5km Fun Run", description: "Perfect for families and beginners", price: 5, currency: "USD", totalQuantity: 0, soldQuantity: 0, maxPerOrder: 10 },
    { id: "t2", name: "10km Standard", description: "Timed race with official certification", price: 5, currency: "USD", totalQuantity: 0, soldQuantity: 0, maxPerOrder: 10 },
    { id: "t3", name: "21km Half Marathon", description: "Full competitive half marathon experience", price: 5, currency: "USD", totalQuantity: 0, soldQuantity: 0, maxPerOrder: 5 },
    { id: "t4", name: "Corporate Team (5 runners)", description: "Register your full team at a discounted rate", price: 5, currency: "USD", totalQuantity: 0, soldQuantity: 0, maxPerOrder: 3 },
  ],
  merch: [] as {
    id: string; eventId: string; name: string; description: string; price: number; currency: string;
    images: string[]; sizes: string[]; colors: string[]; stockQuantity: number; soldQuantity: number;
    pickupAtEvent: boolean; deliveryAvailable: boolean;
  }[],
  shuttles: [] as {
    id: string; eventId: string;
    operator: { companyName: string; verified: boolean; rating: number };
    vehicleType: "bus" | "kombi"; vehicleDescription: string; departurePoint: string;
    departureTime: Date; returnTime: Date; totalSeats: number; bookedSeats: number;
    pricePerSeat: number; currency: string;
  }[],
  vendors: [] as {
    id: string; eventId: string;
    vendor: { businessName: string; category: "catering" | "bar" | "food_truck" | "photography" | "sound" | "security" | "decor" | "other"; logo: null; verified: boolean; rating: number };
    packageName: string; packageDescription: string; price: number; currency: string;
    available: boolean; booked: boolean;
  }[],
  galleries: [] as {
    id: string; eventId: string; name: string; description: string; coverImage: null;
    photoCount: number; packPrice: number; currency: string; isPublic: boolean; photos: never[];
  }[],
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
