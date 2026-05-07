export type UserRole = "attendee" | "organizer" | "vendor" | "admin"
export type EventStatus = "draft" | "published" | "sold_out" | "cancelled" | "completed"
export type OrderStatus = "pending" | "paid" | "cancelled" | "refunded"
export type VehicleType = "kombi" | "bus" | "sedan" | "suv"
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

export interface ShuttleRoute {
  id: string
  eventId: string
  operator: {
    companyName: string
    verified: boolean
    rating: number | null
  }
  vehicleType: VehicleType
  vehicleDescription: string | null
  departurePoint: string
  departureTime: Date
  returnTime: Date | null
  totalSeats: number
  bookedSeats: number
  pricePerSeat: number
  currency: string
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

export interface CartItem {
  type: "ticket" | "merch" | "transport"
  id: string
  name: string
  quantity: number
  unitPrice: number
  currency: string
  meta?: Record<string, unknown>
}
