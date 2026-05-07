import type { VendorCategory } from "@/types"
import {
  UtensilsCrossed, Wine, Truck, Camera, Music2, ShieldCheck, Flower2, Sparkles, type LucideIcon,
} from "lucide-react"

export interface VendorPackage {
  id: string
  name: string
  description: string
  price: number
  currency: string
  bullets: string[]
}

export interface VendorProfile {
  slug: string
  businessName: string
  category: VendorCategory
  tagline: string
  city: string
  serves: string[]
  description: string
  verified: boolean
  rating: number
  reviewCount: number
  totalEvents: number
  responseTimeHours: number
  priceFrom: number
  currency: string
  portfolio: { title: string; year: number; venue: string }[]
  packages: VendorPackage[]
}

export const VENDORS: VendorProfile[] = [
  {
    slug: "mamas-kitchen",
    businessName: "Mama's Kitchen",
    category: "catering",
    tagline: "Home-style Zimbabwean buffets, scaled for crowds.",
    city: "Harare",
    serves: ["Harare", "Chitungwiza", "Norton"],
    description: "Family-run catering with a 12-year track record across corporate runs, weddings, and stadium concerts. Continental and traditional menus from sadza-and-relish to canapés. We handle setup, service, and cleanup.",
    verified: true,
    rating: 4.8,
    reviewCount: 124,
    totalEvents: 47,
    responseTimeHours: 2,
    priceFrom: 300,
    currency: "USD",
    portfolio: [
      { title: "Nyuki Marathon 2025 — breakfast for 1,200", year: 2025, venue: "National Sports Stadium" },
      { title: "Worker Bees AGM dinner", year: 2025, venue: "Meikles Hotel" },
      { title: "ZIMRA staff awards", year: 2024, venue: "Rainbow Towers" },
    ],
    packages: [
      { id: "mk1", name: "Breakfast buffet", description: "Continental + local breakfast for up to 200 guests.", price: 800, currency: "USD",
        bullets: ["Sadza, eggs, toast, juice, tea", "Service staff included", "All equipment + cleanup"] },
      { id: "mk2", name: "Stadium catering — full day", description: "Coverage for up to 1,000 guests across multiple stations.", price: 4500, currency: "USD",
        bullets: ["3 menu rotations", "10 service staff", "Onsite coordinator"] },
      { id: "mk3", name: "Corporate canapés", description: "Plated finger food for 50 guests.", price: 350, currency: "USD",
        bullets: ["12 selections", "Bar-side service", "2 hr coverage"] },
    ],
  },
  {
    slug: "lens-and-light",
    businessName: "Lens & Light Photography",
    category: "photography",
    tagline: "Two photographers. One unforgettable record.",
    city: "Harare",
    serves: ["Nationwide", "Region (SADC)"],
    description: "Editorial-style event coverage with 48-hour turnaround. We photograph concerts, marathons, premieres, and corporate galas. Photos are delivered direct to attendees through TicketPulse galleries.",
    verified: true,
    rating: 4.9,
    reviewCount: 312,
    totalEvents: 86,
    responseTimeHours: 1,
    priceFrom: 300,
    currency: "USD",
    portfolio: [
      { title: "Becoming Madam Boss premiere", year: 2025, venue: "Ster-Kinekor" },
      { title: "Rumble in SA 2024", year: 2024, venue: "Sun Arena Pretoria" },
      { title: "HIFA 2024", year: 2024, venue: "Harare Gardens" },
    ],
    packages: [
      { id: "ll1", name: "Half-day coverage", description: "Up to 4 hours, single photographer.", price: 300, currency: "USD",
        bullets: ["200+ edited photos", "48 hr delivery", "TicketPulse gallery"] },
      { id: "ll2", name: "Full event coverage", description: "Up to 8 hours, two photographers.", price: 600, currency: "USD",
        bullets: ["500+ edited photos", "Highlight reel (3 min)", "48 hr delivery"] },
      { id: "ll3", name: "Multi-day festival", description: "3+ days, two-person team.", price: 2500, currency: "USD",
        bullets: ["1,500+ edited photos", "Daily highlights", "Onsite editing booth"] },
    ],
  },
  {
    slug: "sound-forge-zw",
    businessName: "Sound Forge ZW",
    category: "sound",
    tagline: "Concert-grade PA. Rigged in hours.",
    city: "Harare",
    serves: ["Nationwide"],
    description: "Live sound, lighting and stage rigging for events from 200 to 20,000 capacity. Our crew has run audio for HIFA, Sungura Masters, and most major Harare gigs over the past decade.",
    verified: true,
    rating: 4.7,
    reviewCount: 98,
    totalEvents: 122,
    responseTimeHours: 3,
    priceFrom: 500,
    currency: "USD",
    portfolio: [
      { title: "HIFA Main Stage — 5 nights", year: 2024, venue: "Harare Gardens" },
      { title: "Winky D Stadium Show", year: 2025, venue: "Glamis Arena" },
      { title: "Independence Gala", year: 2025, venue: "National Sports Stadium" },
    ],
    packages: [
      { id: "sf1", name: "Small venue PA", description: "Up to 300 capacity, 4 channels.", price: 500, currency: "USD",
        bullets: ["L-Acoustics PA", "Engineer included", "4 hr coverage"] },
      { id: "sf2", name: "Concert rig", description: "1,000–5,000 capacity, full FOH/monitors.", price: 2400, currency: "USD",
        bullets: ["Line array", "Stage lighting", "FOH + monitor engineers"] },
      { id: "sf3", name: "Festival main stage", description: "10,000+ capacity, multi-day.", price: 5000, currency: "USD",
        bullets: ["Custom rig design", "5-person crew", "On-call backup gear"] },
    ],
  },
  {
    slug: "iron-shield-security",
    businessName: "Iron Shield Security",
    category: "security",
    tagline: "Visible, professional, calm.",
    city: "Harare",
    serves: ["Harare", "Bulawayo", "Mutare"],
    description: "Licensed event security with a focus on de-escalation and crowd flow. All officers are radio-trained, uniformed, and supervised by ex-ZRP commanders. Background-checked, insured, and reliable.",
    verified: true,
    rating: 4.5,
    reviewCount: 76,
    totalEvents: 60,
    responseTimeHours: 4,
    priceFrom: 400,
    currency: "USD",
    portfolio: [
      { title: "Nyuki Marathon 2025", year: 2025, venue: "National Sports Stadium" },
      { title: "Diplomatic gala — French Embassy", year: 2024, venue: "Borrowdale" },
      { title: "Sungura Festival", year: 2024, venue: "Glamis Arena" },
    ],
    packages: [
      { id: "is1", name: "Standard event detail", description: "10 officers, 8 hours.", price: 400, currency: "USD",
        bullets: ["Crowd control", "Bag checks", "Radio coordination"] },
      { id: "is2", name: "VIP + general security", description: "20 officers + 2 close protection.", price: 1500, currency: "USD",
        bullets: ["Backstage cordon", "VIP escort", "Incident lead"] },
      { id: "is3", name: "Stadium-scale", description: "60+ officers, 12+ hours.", price: 3000, currency: "USD",
        bullets: ["Perimeter + entries", "Medical coordination", "Command tent"] },
    ],
  },
  {
    slug: "the-roast-box",
    businessName: "The Roast Box",
    category: "food_truck",
    tagline: "Charcoal grills. No queues.",
    city: "Harare",
    serves: ["Harare", "Norton"],
    description: "Two trucks, three stations — burgers, boerewors, halloumi wraps. We can serve 80 covers an hour and bring our own power, water, and bins.",
    verified: true,
    rating: 4.6,
    reviewCount: 54,
    totalEvents: 28,
    responseTimeHours: 6,
    priceFrom: 150,
    currency: "USD",
    portfolio: [
      { title: "Comedy Night at REPS", year: 2025, venue: "REPS Theatre" },
      { title: "Avondale Sunday Market", year: 2024, venue: "Avondale Shopping Centre" },
    ],
    packages: [
      { id: "rb1", name: "Single truck (4 hrs)", description: "Up to 200 covers across one menu.", price: 150, currency: "USD",
        bullets: ["3 menu items", "Self-contained power", "Card + EcoCash"] },
      { id: "rb2", name: "Two trucks (full day)", description: "Up to 800 covers, expanded menu.", price: 800, currency: "USD",
        bullets: ["6 menu items", "Bin + recycling crew", "Branded signage"] },
    ],
  },
  {
    slug: "petal-and-stem",
    businessName: "Petal & Stem",
    category: "decor",
    tagline: "Floral that photographs.",
    city: "Bulawayo",
    serves: ["Bulawayo", "Victoria Falls", "Hwange"],
    description: "Modern event florals, draping, and stage dressing. We work in sustainable cuts where possible and break down everything within 90 minutes of last call.",
    verified: false,
    rating: 4.7,
    reviewCount: 41,
    totalEvents: 18,
    responseTimeHours: 5,
    priceFrom: 250,
    currency: "USD",
    portfolio: [
      { title: "Vic Falls Carnival 2024", year: 2024, venue: "Elephant Hills" },
      { title: "Bulawayo Arts Awards", year: 2025, venue: "Bulawayo Theatre" },
    ],
    packages: [
      { id: "ps1", name: "Stage florals", description: "Single arrangement, podium + side flanks.", price: 250, currency: "USD",
        bullets: ["Seasonal cuts", "Setup + breakdown", "Photo-ready"] },
      { id: "ps2", name: "Full venue dress", description: "Drapes, florals, lighting accents.", price: 1200, currency: "USD",
        bullets: ["Custom palette", "Onsite stylist", "8 hr coverage"] },
    ],
  },
  {
    slug: "zviyo-bar",
    businessName: "Zviyo Bar",
    category: "bar",
    tagline: "Cocktail bar that travels.",
    city: "Harare",
    serves: ["Harare", "Bulawayo"],
    description: "Mobile bar for premieres, weddings, and brand activations. 20 signature cocktails, plus standard liquor and Chibuku service. Equipment and licensing handled.",
    verified: true,
    rating: 4.4,
    reviewCount: 67,
    totalEvents: 33,
    responseTimeHours: 3,
    priceFrom: 350,
    currency: "USD",
    portfolio: [
      { title: "Becoming Madam Boss after-party", year: 2025, venue: "Pariah State" },
      { title: "Pretoria Concert VIP", year: 2025, venue: "Propaganda" },
    ],
    packages: [
      { id: "zb1", name: "House bar (4 hrs)", description: "Up to 150 guests, 6 cocktails.", price: 350, currency: "USD",
        bullets: ["2 mixologists", "Glassware + ice", "Card + EcoCash"] },
      { id: "zb2", name: "Premium bar (full event)", description: "Up to 500 guests, 12 cocktails + spirits.", price: 1500, currency: "USD",
        bullets: ["4 mixologists", "Premium liquor", "Bespoke menu"] },
    ],
  },
  {
    slug: "captured-moments",
    businessName: "Captured Moments",
    category: "photography",
    tagline: "Victoria Falls' favorite event team.",
    city: "Victoria Falls",
    serves: ["Victoria Falls", "Hwange", "Livingstone"],
    description: "Photography and short-form video for events in the resort towns. We know the light, know the venues, and know how to keep up with a marathon.",
    verified: true,
    rating: 4.8,
    reviewCount: 102,
    totalEvents: 44,
    responseTimeHours: 4,
    priceFrom: 400,
    currency: "USD",
    portfolio: [
      { title: "Vic Falls Carnival 2024", year: 2024, venue: "Elephant Hills" },
      { title: "Falls Marathon 2025", year: 2025, venue: "Vic Falls Town" },
    ],
    packages: [
      { id: "cm1", name: "Half-day", description: "4 hours, photo + 1 min reel.", price: 400, currency: "USD",
        bullets: ["150+ edited photos", "Highlight reel", "TicketPulse gallery"] },
      { id: "cm2", name: "Full day", description: "8 hours, two-person team.", price: 750, currency: "USD",
        bullets: ["400+ edited photos", "3 min reel", "48 hr delivery"] },
    ],
  },
]

export const VENDOR_VISUAL: Record<VendorCategory, {
  label: string
  icon: LucideIcon
  emoji: string
  gradient: string
  ring: string
  accent: string
}> = {
  catering:    { label: "Catering",    icon: UtensilsCrossed, emoji: "🍽️", gradient: "from-orange-50 to-amber-50",    ring: "ring-amber-200/60",    accent: "text-amber-700" },
  bar:         { label: "Bar service", icon: Wine,            emoji: "🍹", gradient: "from-rose-50 to-pink-50",       ring: "ring-rose-200/60",     accent: "text-rose-700" },
  food_truck:  { label: "Food truck",  icon: Truck,           emoji: "🚚", gradient: "from-amber-50 to-yellow-50",    ring: "ring-yellow-200/60",   accent: "text-amber-700" },
  photography: { label: "Photography", icon: Camera,          emoji: "📷", gradient: "from-violet-50 to-fuchsia-50",  ring: "ring-violet-200/60",   accent: "text-violet-700" },
  sound:       { label: "Sound & AV",  icon: Music2,          emoji: "🎚️", gradient: "from-sky-50 to-blue-50",        ring: "ring-sky-200/60",      accent: "text-sky-700" },
  security:    { label: "Security",    icon: ShieldCheck,     emoji: "🛡️", gradient: "from-slate-50 to-blue-50",      ring: "ring-slate-200/60",    accent: "text-slate-700" },
  decor:       { label: "Decor",       icon: Flower2,         emoji: "💐", gradient: "from-pink-50 to-rose-50",       ring: "ring-pink-200/60",     accent: "text-pink-700" },
  other:       { label: "Other",       icon: Sparkles,        emoji: "✨", gradient: "from-slate-50 to-indigo-50",    ring: "ring-indigo-200/60",   accent: "text-indigo-700" },
}

export function getVendorBySlug(slug: string) {
  return VENDORS.find((v) => v.slug === slug) ?? null
}
