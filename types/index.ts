export type UserRole =
  | "attendee"
  | "organizer"
  | "vendor"
  | "admin"
export type EventStatus = "draft" | "pending_review" | "published" | "sold_out" | "cancelled" | "completed"
export type OrderStatus = "pending" | "paid" | "cancelled" | "refunded"
export type VendorCategory =
  | "catering"
  | "bar"
  | "food_truck"
  | "photography"
  | "sound"
  | "security"
  | "decor"
  | "other"

export interface EventSummary {
  id: string
  title: string
  slug: string
  category: string
  status: EventStatus
  venue: string
  city: string
  startsAt: Date
  coverImage: string | null
  featured: boolean
  organizer: { name: string | null; image: string | null }
  tierCount: number
  lowestPrice: number | null
  currency: string
}

export interface MerchItem {
  id: string
  eventId: string
  name: string
  description: string | null
  price: number
  currency: string
  images: string[]
  sizes: string[]
  colors: string[]
  stockQuantity: number
  soldQuantity: number
  pickupAtEvent: boolean
  deliveryAvailable: boolean
}

export interface VendorListing {
  id: string
  eventId: string
  vendor: {
    businessName: string
    category: VendorCategory
    logo: string | null
    verified: boolean
    rating: number | null
  }
  packageName: string
  packageDescription: string | null
  price: number
  currency: string
  available: boolean
  booked: boolean
}

export interface GalleryWithPhotos {
  id: string
  eventId: string
  name: string
  description: string | null
  coverImage: string | null
  photoCount: number
  packPrice: number | null
  currency: string
  isPublic: boolean
  photos: {
    id: string
    url: string
    thumbnailUrl: string | null
    caption: string | null
  }[]
}

export type PaymentState = "PENDING" | "UNPAID" | "PARTIAL" | "PAID" | "FAILED" | "EXPIRED"

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  PENDING: "Pending",
  UNPAID: "Unpaid",
  PARTIAL: "Partially Paid",
  PAID: "Paid",
  FAILED: "Failed",
  EXPIRED: "Expired",
}

export const PAYMENT_STATE_STYLES: Record<PaymentState, string> = {
  PENDING:  "bg-amber-50 text-amber-700 ring-1 ring-amber-200/50",
  UNPAID:   "bg-gray-100 text-gray-600 ring-1 ring-gray-200",
  PARTIAL:  "bg-blue-50 text-blue-700 ring-1 ring-blue-200/50",
  PAID:     "bg-emerald-50 text-emerald-700",
  FAILED:   "bg-red-50 text-red-700 ring-1 ring-red-200/50",
  EXPIRED:  "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
}

export interface CartItem {
  type: "ticket" | "merch" | "transport"
  id: string
  name: string
  quantity: number
  unitPrice: number
  currency: string
  meta?: Record<string, unknown>
}
