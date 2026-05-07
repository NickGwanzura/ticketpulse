import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  uuid,
  pgEnum,
  json,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

// ─── Enums ───────────────────────────────────────────────────────────────────

export const eventStatusEnum = pgEnum("event_status", [
  "draft",
  "published",
  "sold_out",
  "cancelled",
  "completed",
])

export const ticketStatusEnum = pgEnum("ticket_status", [
  "available",
  "reserved",
  "sold",
  "used",
  "refunded",
])

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "cancelled",
  "refunded",
])

export const vehicleTypeEnum = pgEnum("vehicle_type", [
  "kombi",
  "bus",
  "sedan",
  "suv",
])

export const vendorCategoryEnum = pgEnum("vendor_category", [
  "catering",
  "bar",
  "food_truck",
  "photography",
  "sound",
  "security",
  "decor",
  "other",
])

export const userRoleEnum = pgEnum("user_role", [
  "attendee",
  "organizer",
  "vendor",
  "admin",
])

// ─── Auth.js required tables ─────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  role: userRoleEnum("role").default("attendee"),
  phone: text("phone"),
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const accounts = pgTable("accounts", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
})

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

// ─── Events ──────────────────────────────────────────────────────────────────

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizerId: text("organizer_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  slug: text("slug").unique().notNull(),
  description: text("description"),
  category: text("category").notNull(),
  status: eventStatusEnum("status").default("draft"),
  venue: text("venue").notNull(),
  city: text("city").notNull(),
  country: text("country").default("Zimbabwe"),
  address: text("address"),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  coverImage: text("cover_image"),
  tags: json("tags").$type<string[]>().default([]),
  featured: boolean("featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const ticketTiers = pgTable("ticket_tiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD"),
  totalQuantity: integer("total_quantity").notNull(),
  soldQuantity: integer("sold_quantity").default(0),
  maxPerOrder: integer("max_per_order").default(10),
  salesStart: timestamp("sales_start"),
  salesEnd: timestamp("sales_end"),
  createdAt: timestamp("created_at").defaultNow(),
})

export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  tierId: uuid("tier_id").notNull().references(() => ticketTiers.id),
  eventId: uuid("event_id").notNull().references(() => events.id),
  orderId: uuid("order_id"),
  userId: text("user_id").references(() => users.id),
  status: ticketStatusEnum("status").default("available"),
  qrCode: text("qr_code").unique(),
  scannedAt: timestamp("scanned_at"),
  createdAt: timestamp("created_at").defaultNow(),
})

// ─── Orders ──────────────────────────────────────────────────────────────────

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id),
  eventId: uuid("event_id").notNull().references(() => events.id),
  status: orderStatusEnum("status").default("pending"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD"),
  paymentMethod: text("payment_method"),
  paymentRef: text("payment_ref"),
  paidAt: timestamp("paid_at"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  tierId: uuid("tier_id").references(() => ticketTiers.id),
  merchItemId: uuid("merch_item_id"),
  transportBookingId: uuid("transport_booking_id"),
  type: text("type").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
})

// ─── TIER 1: Merchandise ─────────────────────────────────────────────────────

export const merchItems = pgTable("merch_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  organizerId: text("organizer_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD"),
  images: json("images").$type<string[]>().default([]),
  sizes: json("sizes").$type<string[]>().default([]),
  colors: json("colors").$type<string[]>().default([]),
  stockQuantity: integer("stock_quantity").default(0),
  soldQuantity: integer("sold_quantity").default(0),
  active: boolean("active").default(true),
  deliveryAvailable: boolean("delivery_available").default(false),
  pickupAtEvent: boolean("pickup_at_event").default(true),
  createdAt: timestamp("created_at").defaultNow(),
})

// ─── TIER 1: Event Photo Gallery ─────────────────────────────────────────────

export const eventGalleries = pgTable("event_galleries", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  photographerId: text("photographer_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  coverImage: text("cover_image"),
  photoCount: integer("photo_count").default(0),
  packPrice: decimal("pack_price", { precision: 10, scale: 2 }),
  currency: text("currency").default("USD"),
  isPublic: boolean("is_public").default(true),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
})

export const galleryPhotos = pgTable("gallery_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  galleryId: uuid("gallery_id").notNull().references(() => eventGalleries.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  caption: text("caption"),
  tagsData: json("tags_data").$type<string[]>().default([]),
  width: integer("width"),
  height: integer("height"),
  downloadCount: integer("download_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
})

export const photoDownloads = pgTable("photo_downloads", {
  id: uuid("id").primaryKey().defaultRandom(),
  galleryId: uuid("gallery_id").notNull().references(() => eventGalleries.id),
  userId: text("user_id").references(() => users.id),
  orderId: uuid("order_id").references(() => orders.id),
  downloadedAt: timestamp("downloaded_at").defaultNow(),
})

// ─── TIER 1: Transport and Shuttle Bookings ───────────────────────────────────

export const transportOperators = pgTable("transport_operators", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id),
  companyName: text("company_name").notNull(),
  logo: text("logo"),
  phone: text("phone").notNull(),
  licenseNumber: text("license_number"),
  verified: boolean("verified").default(false),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  totalTrips: integer("total_trips").default(0),
  createdAt: timestamp("created_at").defaultNow(),
})

export const shuttleRoutes = pgTable("shuttle_routes", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  operatorId: uuid("operator_id").notNull().references(() => transportOperators.id),
  vehicleType: vehicleTypeEnum("vehicle_type").notNull(),
  vehicleDescription: text("vehicle_description"),
  departurePoint: text("departure_point").notNull(),
  departureLat: decimal("departure_lat", { precision: 10, scale: 7 }),
  departureLng: decimal("departure_lng", { precision: 10, scale: 7 }),
  departureTime: timestamp("departure_time").notNull(),
  returnTime: timestamp("return_time"),
  totalSeats: integer("total_seats").notNull(),
  bookedSeats: integer("booked_seats").default(0),
  pricePerSeat: decimal("price_per_seat", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD"),
  notes: text("notes"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
})

export const transportBookings = pgTable("transport_bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  routeId: uuid("route_id").notNull().references(() => shuttleRoutes.id),
  userId: text("user_id").notNull().references(() => users.id),
  orderId: uuid("order_id").references(() => orders.id),
  seats: integer("seats").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
})

// ─── TIER 1: Food and Vendor Bookings ────────────────────────────────────────

export const vendors = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id),
  businessName: text("business_name").notNull(),
  category: vendorCategoryEnum("category").notNull(),
  logo: text("logo"),
  description: text("description"),
  phone: text("phone"),
  email: text("email"),
  city: text("city"),
  verified: boolean("verified").default(false),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  totalEvents: integer("total_events").default(0),
  portfolio: json("portfolio").$type<string[]>().default([]),
  priceRange: text("price_range"),
  createdAt: timestamp("created_at").defaultNow(),
})

export const vendorListings = pgTable("vendor_listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  vendorId: uuid("vendor_id").notNull().references(() => vendors.id),
  packageName: text("package_name").notNull(),
  packageDescription: text("package_description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD"),
  maxCapacity: integer("max_capacity"),
  available: boolean("available").default(true),
  booked: boolean("booked").default(false),
  bookedById: text("booked_by_id").references(() => users.id),
  bookedAt: timestamp("booked_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
})

// ─── Relations ────────────────────────────────────────────────────────────────

export const eventsRelations = relations(events, ({ one, many }) => ({
  organizer: one(users, { fields: [events.organizerId], references: [users.id] }),
  ticketTiers: many(ticketTiers),
  tickets: many(tickets),
  orders: many(orders),
  merch: many(merchItems),
  galleries: many(eventGalleries),
  shuttleRoutes: many(shuttleRoutes),
  vendorListings: many(vendorListings),
}))

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  organizedEvents: many(events),
  transportBookings: many(transportBookings),
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  event: one(events, { fields: [orders.eventId], references: [events.id] }),
  items: many(orderItems),
}))

export const ticketTiersRelations = relations(ticketTiers, ({ one }) => ({
  event: one(events, { fields: [ticketTiers.eventId], references: [events.id] }),
}))

export const shuttleRoutesRelations = relations(shuttleRoutes, ({ one, many }) => ({
  event: one(events, { fields: [shuttleRoutes.eventId], references: [events.id] }),
  operator: one(transportOperators, { fields: [shuttleRoutes.operatorId], references: [transportOperators.id] }),
  bookings: many(transportBookings),
}))

export const galleryRelations = relations(eventGalleries, ({ one, many }) => ({
  event: one(events, { fields: [eventGalleries.eventId], references: [events.id] }),
  photos: many(galleryPhotos),
}))
