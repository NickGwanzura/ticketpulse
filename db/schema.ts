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
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

// ─── Enums ───────────────────────────────────────────────────────────────────

export const eventStatusEnum = pgEnum("event_status", [
  "draft",
  "pending_review",
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
  "cancelled",
])

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "awaiting_verification",
  "paid",
  "completed",
  "cancelled",
  "refunded",
  "expired",
])

export const analyticsEventEnum = pgEnum("analytics_event", [
  "EVENT_VIEWED",
  "CHECKOUT_STARTED",
  "BUYER_DETAILS_SUBMITTED",
  "PAYMENT_METHOD_SELECTED",
  "PAYMENT_INITIATED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_FAILED",
  "ORDER_ABANDONED",
  "TICKET_ISSUED",
  "TICKET_CHECKED_IN",
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

export const promoCodeTypeEnum = pgEnum("promo_code_type", [
  "percent",
  "fixed",
])

export const userRoleEnum = pgEnum("user_role", [
  "attendee",
  "organizer",
  "vendor",
  "admin",
  "transport_operator",
  "dispatcher",
  "driver",
  "conductor",
])

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "declined",
  "expired",
])

export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "approved",
  "rejected",
])

export const staffRoleEnum = pgEnum("staff_role", [
  "security",
  "usher",
  "dj_sound",
  "bar_staff",
  "vip_host",
  "media",
  "other",
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
  organizerSlug: text("organizer_slug").unique(),
  organizerBio: text("organizer_bio"),
  passwordHash: text("password_hash"),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("6.00"),
  approvedAt: timestamp("approved_at", { mode: "date" }),
  organizerFrozenAt: timestamp("organizer_frozen_at", { mode: "date" }),
  organizerFreezeReason: text("organizer_freeze_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("users_role_approved_idx").on(table.role, table.approvedAt),
  index("users_created_at_idx").on(table.createdAt),
])

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
}, (table) => [
  primaryKey({ columns: [table.provider, table.providerAccountId] }),
])

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

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
    index("password_reset_tokens_user_id_idx").on(table.userId),
  ])

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("email_verification_tokens_user_id_idx").on(table.userId),
])

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
  googleMapsUrl: text("google_maps_url"),
  tags: json("tags").$type<string[]>().default([]),
  featured: boolean("featured").default(false),
  sponsored: boolean("sponsored").default(false),
  sponsorName: text("sponsor_name"),
  sponsorLogoUrl: text("sponsor_logo_url"),
  sponsoredAt: timestamp("sponsored_at"),
  sponsorshipExpiresAt: timestamp("sponsorship_expires_at"),
  designRequestPending: boolean("design_request_pending").default(false),
  designBrief: text("design_brief"),
  designLogoUrl: text("design_logo_url"),
  designDelivered: boolean("design_delivered").default(false),
  hideOrganizerName: boolean("hide_organizer_name").default(false),
  faq: text("faq"),
  promoImages: json("promo_images").$type<string[]>().default([]),
  absorbFee: boolean("absorb_fee").default(false),
  platformFeePercent: decimal("platform_fee_percent", { precision: 5, scale: 2 }).default("6.00"),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("events_organizer_id_idx").on(table.organizerId),
  index("events_status_idx").on(table.status),
  index("events_organizer_status_idx").on(table.organizerId, table.status),
  index("events_status_starts_at_idx").on(table.status, table.startsAt),
])

export const eventModerationLog = pgTable("event_moderation_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  adminId: text("admin_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(), // "approved" | "rejected"
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("event_moderation_log_event_id_idx").on(table.eventId),
])

export const eventLineup = pgTable("event_lineup", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role"),
  bio: text("bio"),
  imageUrl: text("image_url"),
  socialUrl: text("social_url"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("event_lineup_event_id_idx").on(table.eventId),
])

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
	  // Early bird pricing — active until earlyBirdUntil date OR earlyBirdQuantity sold, whichever comes first
	  earlyBirdPrice: decimal("early_bird_price", { precision: 10, scale: 2 }),
	  earlyBirdUntil: timestamp("early_bird_until"),
	  earlyBirdQuantity: integer("early_bird_quantity"),
	  // Group/volume discount — reduced per-unit price when buying groupMinQty or more
	  groupPrice: decimal("group_price", { precision: 10, scale: 2 }),
	  groupMinQty: integer("group_min_qty").default(4),
	  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("ticket_tiers_event_id_idx").on(table.eventId),
])

export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  tierId: uuid("tier_id").notNull().references(() => ticketTiers.id),
  eventId: uuid("event_id").notNull().references(() => events.id),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id),
  status: ticketStatusEnum("status").default("available"),
  qrCode: text("qr_code").unique(),
  scannedAt: timestamp("scanned_at"),
  // Staff ticket fields
  isStaffTicket: boolean("is_staff_ticket").default(false),
  staffRole: staffRoleEnum("staff_role"),
  staffName: text("staff_name"),
  staffPhone: text("staff_phone"),
  // Transfer fields
  transferToken: text("transfer_token").unique(),
  transferToEmail: text("transfer_to_email"),
  transferToName: text("transfer_to_name"),
  transferExpiresAt: timestamp("transfer_expires_at"),
  transferredAt: timestamp("transferred_at"),
  holderName: text("holder_name"),
  holderEmail: text("holder_email"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("tickets_event_id_idx").on(table.eventId),
  index("tickets_user_id_idx").on(table.userId),
  index("tickets_order_id_idx").on(table.orderId),
  index("tickets_staff_event_idx").on(table.eventId, table.isStaffTicket),
  index("tickets_scanned_at_idx").on(table.scannedAt),
])

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  reviewerName: text("reviewer_name").notNull(),
  reviewerEmail: text("reviewer_email").notNull(),
  rating: integer("rating").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  source: text("source").default("public_link"),
  status: reviewStatusEnum("status").default("pending").notNull(),
  publicConsent: boolean("public_consent").default(true).notNull(),
  featured: boolean("featured").default(false).notNull(),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("reviews_event_id_idx").on(table.eventId),
  index("reviews_order_id_idx").on(table.orderId),
  index("reviews_status_idx").on(table.status),
  index("reviews_created_at_idx").on(table.createdAt),
])

// ─── Promo codes ──────────────────────────────────────────────────────────────

export const promoCodes = pgTable("promo_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  type: promoCodeTypeEnum("type").notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  maxUses: integer("max_uses").default(0),
  usedCount: integer("used_count").default(0),
  minPurchaseAmount: decimal("min_purchase_amount", { precision: 10, scale: 2 }).default("0"),
  expiresAt: timestamp("expires_at"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("promo_codes_code_event_idx").on(table.code, table.eventId),
])

// ─── Orders ──────────────────────────────────────────────────────────────────

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id),
  eventId: uuid("event_id").notNull().references(() => events.id),
  status: orderStatusEnum("status").default("pending"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD"),
  paymentMethod: text("payment_method"),
  paymentRef: text("payment_ref"),
  paidAt: timestamp("paid_at"),
  // Guest checkout — captured before the buyer verifies and links to a user.
  guestEmail: text("guest_email"),
  guestName: text("guest_name"),
  guestPhone: text("guest_phone"),
  // Legacy verification fields — kept for backward-compat with existing rows.
  // Magic-link verification was removed; these columns are no longer written.
  verificationSentAt: timestamp("verification_sent_at"),
  verificationExpires: timestamp("verification_expires"),
  verifiedAt: timestamp("verified_at"),
  completedAt: timestamp("completed_at"),
  completedBy: text("completed_by"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("orders_user_id_idx").on(table.userId),
  index("orders_event_id_idx").on(table.eventId),
  index("orders_guest_email_idx").on(table.guestEmail),
  index("orders_status_event_idx").on(table.eventId, table.status),
  index("orders_status_created_at_idx").on(table.status, table.createdAt),
  index("orders_metadata_gin_idx").using("gin", table.metadata),
  index("orders_created_at_idx").on(table.createdAt),
  index("orders_paid_at_idx").on(table.paidAt),
])

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
}, (table) => [
  index("order_items_order_id_idx").on(table.orderId),
])

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
}, (table) => [
  index("merch_items_event_id_idx").on(table.eventId),
])

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
}, (table) => [
  index("event_galleries_event_id_idx").on(table.eventId),
])

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
}, (table) => [
  index("gallery_photos_gallery_id_idx").on(table.galleryId),
])

export const photoDownloads = pgTable("photo_downloads", {
  id: uuid("id").primaryKey().defaultRandom(),
  galleryId: uuid("gallery_id").notNull().references(() => eventGalleries.id),
  userId: text("user_id").references(() => users.id),
  orderId: uuid("order_id").references(() => orders.id),
  downloadedAt: timestamp("downloaded_at").defaultNow(),
})

// ─── Waitlist ─────────────────────────────────────────────────────────────────

export const eventWaitlist = pgTable("event_waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
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
  rejectedAt: timestamp("rejected_at"),
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
}, (table) => [
  index("shuttle_routes_event_id_idx").on(table.eventId),
])

export const transportBookings = pgTable("transport_bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  routeId: uuid("route_id").notNull().references(() => shuttleRoutes.id),
  userId: text("user_id").notNull().references(() => users.id),
  orderId: uuid("order_id").references(() => orders.id),
  seats: integer("seats").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("transport_bookings_route_id_idx").on(table.routeId),
  index("transport_bookings_user_id_idx").on(table.userId),
])

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
  rejectedAt: timestamp("rejected_at"),
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
}, (table) => [
  index("vendor_listings_event_id_idx").on(table.eventId),
  index("vendor_listings_vendor_id_idx").on(table.vendorId),
])

// ─── Collaborators: Event Organisers ──────────────────────────────────────────

export const eventOrganisers = pgTable("event_organisers", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  invitedBy: text("invited_by").notNull().references(() => users.id),
  role: text("role").default("editor"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("event_organisers_event_user_idx").on(table.eventId, table.userId),
  index("event_organisers_event_id_idx").on(table.eventId),
  index("event_organisers_user_id_idx").on(table.userId),
])

export const organiserInvites = pgTable("organiser_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  invitedBy: text("invited_by").notNull().references(() => users.id),
  email: text("email").notNull(),
  role: text("role").default("editor"),
  token: text("token").notNull().unique(),
  status: inviteStatusEnum("status").default("pending"),
  acceptedAt: timestamp("accepted_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("organiser_invites_event_id_idx").on(table.eventId),
  index("organiser_invites_token_idx").on(table.token),
  uniqueIndex("organiser_invites_event_email_idx").on(table.eventId, table.email),
])

// ─── Relations ────────────────────────────────────────────────────────────────

export const eventsRelations = relations(events, ({ one, many }) => ({
  organizer: one(users, { fields: [events.organizerId], references: [users.id] }),
  ticketTiers: many(ticketTiers),
  promoCodes: many(promoCodes),
  tickets: many(tickets),
  orders: many(orders),
  merch: many(merchItems),
  galleries: many(eventGalleries),
  shuttleRoutes: many(shuttleRoutes),
  vendorListings: many(vendorListings),
  eventOrganisers: many(eventOrganisers),
  organiserInvites: many(organiserInvites),
  ticketQuestions: many(ticketQuestions),
}))

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  organizedEvents: many(events),
  transportBookings: many(transportBookings),
  invitedOrganisers: many(eventOrganisers),
}))

export const eventOrganisersRelations = relations(eventOrganisers, ({ one }) => ({
  event: one(events, { fields: [eventOrganisers.eventId], references: [events.id] }),
  user: one(users, { fields: [eventOrganisers.userId], references: [users.id] }),
  inviter: one(users, { fields: [eventOrganisers.invitedBy], references: [users.id] }),
}))

export const organiserInvitesRelations = relations(organiserInvites, ({ one }) => ({
  event: one(events, { fields: [organiserInvites.eventId], references: [events.id] }),
  inviter: one(users, { fields: [organiserInvites.invitedBy], references: [users.id] }),
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  event: one(events, { fields: [orders.eventId], references: [events.id] }),
  items: many(orderItems),
  questionResponses: many(ticketQuestionResponses),
}))

export const ticketTiersRelations = relations(ticketTiers, ({ one }) => ({
  event: one(events, { fields: [ticketTiers.eventId], references: [events.id] }),
}))

export const ticketsRelations = relations(tickets, ({ one }) => ({
  event: one(events, { fields: [tickets.eventId], references: [events.id] }),
  tier: one(ticketTiers, { fields: [tickets.tierId], references: [ticketTiers.id] }),
  order: one(orders, { fields: [tickets.orderId], references: [orders.id] }),
}))

export const reviewsRelations = relations(reviews, ({ one }) => ({
  event: one(events, { fields: [reviews.eventId], references: [events.id] }),
  order: one(orders, { fields: [reviews.orderId], references: [orders.id] }),
}))

export const shuttleRoutesRelations = relations(shuttleRoutes, ({ one, many }) => ({
  event: one(events, { fields: [shuttleRoutes.eventId], references: [events.id] }),
  operator: one(transportOperators, { fields: [shuttleRoutes.operatorId], references: [transportOperators.id] }),
  bookings: many(transportBookings),
}))

export const ticketQuestions = pgTable("ticket_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  required: boolean("required").default(false),
  scope: text("scope").$type<"order" | "attendee">().default("order"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("ticket_questions_event_id_idx").on(table.eventId),
])

export const ticketQuestionResponses = pgTable("ticket_question_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id").notNull().references(() => ticketQuestions.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  response: text("response").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("ticket_question_responses_question_id_idx").on(table.questionId),
  index("ticket_question_responses_order_id_idx").on(table.orderId),
])

export const ticketQuestionsRelations = relations(ticketQuestions, ({ one, many }) => ({
  event: one(events, { fields: [ticketQuestions.eventId], references: [events.id] }),
  responses: many(ticketQuestionResponses),
}))

export const ticketQuestionResponsesRelations = relations(ticketQuestionResponses, ({ one }) => ({
  question: one(ticketQuestions, { fields: [ticketQuestionResponses.questionId], references: [ticketQuestions.id] }),
  order: one(orders, { fields: [ticketQuestionResponses.orderId], references: [orders.id] }),
}))

// ─── Analytics / Funnel Events ───────────────────────────────────────────────

export const analyticsEvents = pgTable("analytics_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  event: analyticsEventEnum("event").notNull(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  organizerId: text("organizer_id"),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  sessionId: text("session_id"),
  buyerEmail: text("buyer_email"),
  paymentMethod: text("payment_method"),
  ticketType: text("ticket_type"),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  source: text("source"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("analytics_events_event_id_idx").on(table.eventId),
  index("analytics_events_event_created_idx").on(table.eventId, table.createdAt),
  index("analytics_events_order_id_idx").on(table.orderId),
  index("analytics_events_session_id_idx").on(table.sessionId),
  index("analytics_events_event_type_idx").on(table.event, table.createdAt),
])

export const organizerLifecycleEvents = pgTable("organizer_lifecycle_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizerId: text("organizer_id").references(() => users.id, { onDelete: "set null" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  step: text("step").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  source: text("source"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("organizer_lifecycle_organizer_created_idx").on(table.organizerId, table.createdAt),
  index("organizer_lifecycle_step_created_idx").on(table.step, table.createdAt),
  index("organizer_lifecycle_event_idx").on(table.eventId),
  uniqueIndex("organizer_lifecycle_dedupe_idx").on(table.dedupeKey),
])

export const ticketScanLogs = pgTable("ticket_scan_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  scannerUserId: text("scanner_user_id").references(() => users.id, { onDelete: "set null" }),
  rawCode: text("raw_code").notNull(),
  outcome: text("outcome").notNull(),
  reason: text("reason"),
  source: text("source").default("organizer_web"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ticket_scan_logs_ticket_id_idx").on(table.ticketId),
  index("ticket_scan_logs_event_id_idx").on(table.eventId),
  index("ticket_scan_logs_order_id_idx").on(table.orderId),
  index("ticket_scan_logs_scanner_user_id_idx").on(table.scannerUserId),
  index("ticket_scan_logs_created_at_idx").on(table.createdAt),
])

export const paymentLedger = pgTable("payment_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  eventId: uuid("event_id").notNull().references(() => events.id),
  transactionTrace: text("transaction_trace").notNull(),
  salesOrderTrace: text("sales_order_trace").notNull(),
  invoiceId: text("invoice_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD"),
  processor: text("processor").notNull(),
  velocityPollStatus: text("velocity_poll_status"),
  localStatus: text("local_status").notNull(),
  source: text("source").notNull(),
  rawPayload: json("raw_payload"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("payment_ledger_trace_idx").on(table.transactionTrace),
  index("payment_ledger_order_idx").on(table.orderId),
  index("payment_ledger_event_idx").on(table.eventId),
  index("payment_ledger_created_idx").on(table.createdAt),
])

export const paymentLedgerRelations = relations(paymentLedger, ({ one }) => ({
  order: one(orders, { fields: [paymentLedger.orderId], references: [orders.id] }),
  event: one(events, { fields: [paymentLedger.eventId], references: [events.id] }),
}))

export const velocitySettlements = pgTable("velocity_settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  settlementDate: timestamp("settlement_date").notNull(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  reference: text("reference").notNull(),
  notes: text("notes"),
  recordedBy: text("recorded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("velocity_settlements_reference_idx").on(table.reference),
  index("velocity_settlements_date_idx").on(table.settlementDate),
  index("velocity_settlements_created_idx").on(table.createdAt),
  index("velocity_settlements_event_idx").on(table.eventId),
])

export const galleryRelations = relations(eventGalleries, ({ one, many }) => ({
  event: one(events, { fields: [eventGalleries.eventId], references: [events.id] }),
  photos: many(galleryPhotos),
}))

// ─── Platform Settings ───────────────────────────────────────────────────────

export const platformEnvEnum = pgEnum("platform_env", ["dev", "stage", "prod"])

export const platformSettings = pgTable("platform_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(),
  value: json("value").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
  version: integer("version").default(1),
  env: platformEnvEnum("env").default("prod").notNull(),
}, (table) => [
  uniqueIndex("platform_settings_key_env_idx").on(table.key, table.env),
])

// ─── Payouts ─────────────────────────────────────────────────────────────────

export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "approved",
  "processing",
  "paid",
  "held",
  "rejected",
  "failed",
  "cancelled",
])

export const payoutMethodEnum = pgEnum("payout_method", [
  "ecocash",
  "bank_usd",
  "bank_zar",
  "cash",
])

export const payouts = pgTable("payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  method: payoutMethodEnum("method").default("ecocash").notNull(),
  status: payoutStatusEnum("status").default("pending").notNull(),
  accountNumber: text("account_number"),
  accountName: text("account_name"),
  bankName: text("bank_name"),
  rejectionReason: text("rejection_reason"),
  proofReference: text("proof_reference"),
  reviewedBy: text("reviewed_by"),
  processedAt: timestamp("processed_at"),
  processedBy: text("processed_by"),
  notes: text("notes"),
  balanceSnapshot: jsonb("balance_snapshot"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("payouts_user_idx").on(table.userId),
  index("payouts_status_idx").on(table.status),
  index("payouts_created_idx").on(table.createdAt),
])

export const payoutsRelations = relations(payouts, ({ one }) => ({
  user: one(users, { fields: [payouts.userId], references: [users.id] }),
  event: one(events, { fields: [payouts.eventId], references: [events.id] }),
}))

// ─── Payout Audit Log ─────────────────────────────────────────────────────────

export const payoutAuditLog = pgTable("payout_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  payoutId: uuid("payout_id").notNull().references(() => payouts.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  fromStatus: payoutStatusEnum("from_status"),
  toStatus: payoutStatusEnum("to_status"),
  performedBy: text("performed_by").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("payout_audit_log_payout_id_idx").on(table.payoutId),
  index("payout_audit_log_created_idx").on(table.createdAt),
])

// ─── Administrative Audit Log ───────────────────────────────────────────────

export const adminAuditLog = pgTable("admin_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: text("actor_id").notNull(),
  actorEmail: text("actor_email"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("admin_audit_log_target_idx").on(table.targetType, table.targetId),
  index("admin_audit_log_actor_idx").on(table.actorId),
  index("admin_audit_log_created_idx").on(table.createdAt),
])

// ─── System Heartbeats ──────────────────────────────────────────────────────

export const systemHeartbeats = pgTable("system_heartbeats", {
  key: text("key").primaryKey(),
  lastSuccessAt: timestamp("last_success_at"),
  lastErrorAt: timestamp("last_error_at"),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ─── Organiser Fee Dues ──────────────────────────────────────────────────────
// Tracks platform fees owed to us when an organiser is paid directly by the
// buyer (cash/bank transfer at the door, etc.) and we only issue the ticket —
// no money passes through us, so there's nothing to pay the organiser, but we
// still earned our commission on the sale and need to collect it separately.

export const organizerFeeDueStatusEnum = pgEnum("organizer_fee_due_status", [
  "outstanding",
  "settled",
  "waived",
])

export const organizerFeeDues = pgTable("organizer_fee_dues", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  organizerId: text("organizer_id").notNull().references(() => users.id),
  grossAmount: decimal("gross_amount", { precision: 10, scale: 2 }).notNull(),
  feeRate: decimal("fee_rate", { precision: 5, scale: 4 }).notNull(),
  feeAmount: decimal("fee_amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  status: organizerFeeDueStatusEnum("status").default("outstanding").notNull(),
  settledAt: timestamp("settled_at"),
  settledBy: text("settled_by"),
  note: text("note"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("organizer_fee_dues_organizer_idx").on(table.organizerId),
  index("organizer_fee_dues_event_idx").on(table.eventId),
  index("organizer_fee_dues_status_idx").on(table.status),
])

export const organizerFeeDuesRelations = relations(organizerFeeDues, ({ one }) => ({
  organizer: one(users, { fields: [organizerFeeDues.organizerId], references: [users.id] }),
  event: one(events, { fields: [organizerFeeDues.eventId], references: [events.id] }),
  order: one(orders, { fields: [organizerFeeDues.orderId], references: [orders.id] }),
}))

// ─── Payout Clawbacks ────────────────────────────────────────────────────────
// When a refund is issued on an order whose payout has already been paid to
// the organiser, revenue-summary.ts's availableBalance would otherwise clamp
// the shortfall to zero and the money owed back would silently disappear.
// This table makes that shortfall an explicit, trackable amount instead.

export const payoutClawbackStatusEnum = pgEnum("payout_clawback_status", [
  "outstanding",
  "recovered",
  "waived",
])

export const payoutClawbacks = pgTable("payout_clawbacks", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  organizerId: text("organizer_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  reason: text("reason").notNull(),
  status: payoutClawbackStatusEnum("status").default("outstanding").notNull(),
  recoveredAt: timestamp("recovered_at"),
  recoveredBy: text("recovered_by"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("payout_clawbacks_organizer_idx").on(table.organizerId),
  index("payout_clawbacks_event_idx").on(table.eventId),
  index("payout_clawbacks_status_idx").on(table.status),
])

export const payoutClawbacksRelations = relations(payoutClawbacks, ({ one }) => ({
  organizer: one(users, { fields: [payoutClawbacks.organizerId], references: [users.id] }),
  event: one(events, { fields: [payoutClawbacks.eventId], references: [events.id] }),
  order: one(orders, { fields: [payoutClawbacks.orderId], references: [orders.id] }),
}))

// ─── WhatsApp Checkout Sessions ──────────────────────────────────────────────
// Conversation state for the "text EARLYBIRD to buy" WhatsApp checkout flow.
// One row per chat; the bot walks the buyer through event/quantity/name/email
// then hands off to the existing Velocity EcoCash checkout.

export const whatsappCheckoutStepEnum = pgEnum("whatsapp_checkout_step", [
  "choose_event",
  "quantity",
  "name",
  "email",
  // Asked only when the sender's chat id is a WhatsApp @lid privacy id, so
  // their EcoCash number can't be derived from the chat id itself.
  "phone",
  "done",
  "cancelled",
])

export const whatsappCheckoutSessions = pgTable("whatsapp_checkout_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: text("chat_id").notNull().unique(),
  step: whatsappCheckoutStepEnum("step").notNull().default("choose_event"),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  tierId: uuid("tier_id").references(() => ticketTiers.id, { onDelete: "set null" }),
  quantity: integer("quantity"),
  guestName: text("guest_name"),
  guestEmail: text("guest_email"),
  guestPhone: text("guest_phone"),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  // Event ids offered when multiple events have an active early-bird tier at
  // once, in display order, so a numeric reply ("2") can be resolved back to
  // the event/tier it referred to.
  candidateEventIds: jsonb("candidate_event_ids"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ─── Organiser add-on packages (Sponsored Post, Graphic Design) ─────────────
export const organizerPackages = pgTable("organizer_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD"),
  durationHours: integer("duration_hours"),
  features: json("features").$type<string[]>().default([]),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
})

// ─── Notifications ───────────────────────────────────────────────────────────

export const notificationTypeEnum = pgEnum("notification_type", [
  "order_paid",
  "order_cancelled",
  "order_refunded",
  "ticket_issued",
  "ticket_checked_in",
  "payout_requested",
  "payout_paid",
  "payout_rejected",
  "payout_approved",
  "payout_failed",
  "event_published",
  "event_sold_out",
  "system",
])

export const notificationPriorityEnum = pgEnum("notification_priority", ["low", "normal", "high"])

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  priority: notificationPriorityEnum("priority").default("normal").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  read: boolean("read").default(false).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_read_idx").on(table.read),
  index("notifications_created_idx").on(table.createdAt),
  index("notifications_priority_idx").on(table.priority),
])

// ─── Past-attendee announcement log ──────────────────────────────────────────
// Tracks which recipient emails have already been sent a past-attendee
// announcement for a given event, so re-sends never duplicate.
export const pastAnnounceLog = pgTable("past_announce_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  recipientEmail: text("recipient_email").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("past_announce_log_event_email_idx").on(table.eventId, table.recipientEmail),
])
