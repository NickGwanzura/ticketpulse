CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'sold_out', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('available', 'reserved', 'sold', 'used', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('attendee', 'organizer', 'vendor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('kombi', 'bus', 'sedan', 'suv');--> statement-breakpoint
CREATE TYPE "public"."vendor_category" AS ENUM('catering', 'bar', 'food_truck', 'photography', 'sound', 'security', 'decor', 'other');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "event_galleries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"photographer_id" text,
	"name" text NOT NULL,
	"description" text,
	"cover_image" text,
	"photo_count" integer DEFAULT 0,
	"pack_price" numeric(10, 2),
	"currency" text DEFAULT 'USD',
	"is_public" boolean DEFAULT true,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizer_id" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"status" "event_status" DEFAULT 'draft',
	"venue" text NOT NULL,
	"city" text NOT NULL,
	"country" text DEFAULT 'Zimbabwe',
	"address" text,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp,
	"cover_image" text,
	"tags" json DEFAULT '[]'::json,
	"featured" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "gallery_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"caption" text,
	"tags_data" json DEFAULT '[]'::json,
	"width" integer,
	"height" integer,
	"download_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "merch_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"organizer_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD',
	"images" json DEFAULT '[]'::json,
	"sizes" json DEFAULT '[]'::json,
	"colors" json DEFAULT '[]'::json,
	"stock_quantity" integer DEFAULT 0,
	"sold_quantity" integer DEFAULT 0,
	"active" boolean DEFAULT true,
	"delivery_available" boolean DEFAULT false,
	"pickup_at_event" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"tier_id" uuid,
	"merch_item_id" uuid,
	"transport_booking_id" uuid,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'pending',
	"total_amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD',
	"payment_method" text,
	"payment_ref" text,
	"paid_at" timestamp,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "photo_downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"user_id" text,
	"order_id" uuid,
	"downloaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shuttle_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"vehicle_type" "vehicle_type" NOT NULL,
	"vehicle_description" text,
	"departure_point" text NOT NULL,
	"departure_lat" numeric(10, 7),
	"departure_lng" numeric(10, 7),
	"departure_time" timestamp NOT NULL,
	"return_time" timestamp,
	"total_seats" integer NOT NULL,
	"booked_seats" integer DEFAULT 0,
	"price_per_seat" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD',
	"notes" text,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticket_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD',
	"total_quantity" integer NOT NULL,
	"sold_quantity" integer DEFAULT 0,
	"max_per_order" integer DEFAULT 10,
	"sales_start" timestamp,
	"sales_end" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"order_id" uuid,
	"user_id" text,
	"status" "ticket_status" DEFAULT 'available',
	"qr_code" text,
	"scanned_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tickets_qr_code_unique" UNIQUE("qr_code")
);
--> statement-breakpoint
CREATE TABLE "transport_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"order_id" uuid,
	"seats" integer NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"status" "order_status" DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transport_operators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"company_name" text NOT NULL,
	"logo" text,
	"phone" text NOT NULL,
	"license_number" text,
	"verified" boolean DEFAULT false,
	"rating" numeric(3, 2),
	"total_trips" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp,
	"image" text,
	"role" "user_role" DEFAULT 'attendee',
	"phone" text,
	"bio" text,
	"password_hash" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendor_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"package_name" text NOT NULL,
	"package_description" text,
	"price" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD',
	"max_capacity" integer,
	"available" boolean DEFAULT true,
	"booked" boolean DEFAULT false,
	"booked_by_id" text,
	"booked_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"business_name" text NOT NULL,
	"category" "vendor_category" NOT NULL,
	"logo" text,
	"description" text,
	"phone" text,
	"email" text,
	"city" text,
	"verified" boolean DEFAULT false,
	"rating" numeric(3, 2),
	"total_events" integer DEFAULT 0,
	"portfolio" json DEFAULT '[]'::json,
	"price_range" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_galleries" ADD CONSTRAINT "event_galleries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_galleries" ADD CONSTRAINT "event_galleries_photographer_id_users_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_photos" ADD CONSTRAINT "gallery_photos_gallery_id_event_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."event_galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merch_items" ADD CONSTRAINT "merch_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merch_items" ADD CONSTRAINT "merch_items_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tier_id_ticket_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."ticket_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_downloads" ADD CONSTRAINT "photo_downloads_gallery_id_event_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."event_galleries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_downloads" ADD CONSTRAINT "photo_downloads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_downloads" ADD CONSTRAINT "photo_downloads_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shuttle_routes" ADD CONSTRAINT "shuttle_routes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shuttle_routes" ADD CONSTRAINT "shuttle_routes_operator_id_transport_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."transport_operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_tiers" ADD CONSTRAINT "ticket_tiers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tier_id_ticket_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."ticket_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_bookings" ADD CONSTRAINT "transport_bookings_route_id_shuttle_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."shuttle_routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_bookings" ADD CONSTRAINT "transport_bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_bookings" ADD CONSTRAINT "transport_bookings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_operators" ADD CONSTRAINT "transport_operators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_listings" ADD CONSTRAINT "vendor_listings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_listings" ADD CONSTRAINT "vendor_listings_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_listings" ADD CONSTRAINT "vendor_listings_booked_by_id_users_id_fk" FOREIGN KEY ("booked_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_galleries_event_id_idx" ON "event_galleries" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "events_organizer_id_idx" ON "events" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "events_status_idx" ON "events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gallery_photos_gallery_id_idx" ON "gallery_photos" USING btree ("gallery_id");--> statement-breakpoint
CREATE INDEX "merch_items_event_id_idx" ON "merch_items" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_event_id_idx" ON "orders" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "shuttle_routes_event_id_idx" ON "shuttle_routes" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_tiers_event_id_idx" ON "ticket_tiers" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "tickets_event_id_idx" ON "tickets" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "tickets_user_id_idx" ON "tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tickets_order_id_idx" ON "tickets" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "transport_bookings_route_id_idx" ON "transport_bookings" USING btree ("route_id");--> statement-breakpoint
CREATE INDEX "transport_bookings_user_id_idx" ON "transport_bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vendor_listings_event_id_idx" ON "vendor_listings" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "vendor_listings_vendor_id_idx" ON "vendor_listings" USING btree ("vendor_id");