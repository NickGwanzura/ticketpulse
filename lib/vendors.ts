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
  /** Optional DB id. Falls back to `slug` when the vendor lives only in the
   *  in-memory list (e.g. seeded marketing fixtures). */
  id?: string
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

export const VENDORS: VendorProfile[] = []

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
