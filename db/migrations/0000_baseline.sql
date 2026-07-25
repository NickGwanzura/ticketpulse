CREATE TYPE "public"."analytics_event" AS ENUM('EVENT_VIEWED', 'CHECKOUT_STARTED', 'BUYER_DETAILS_SUBMITTED', 'PAYMENT_METHOD_SELECTED', 'PAYMENT_INITIATED', 'PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'ORDER_ABANDONED', 'TICKET_ISSUED', 'TICKET_CHECKED_IN');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'pending_review', 'published', 'sold_out', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('order_paid', 'order_cancelled', 'order_refunded', 'ticket_issued', 'ticket_checked_in', 'payout_requested', 'payout_paid', 'payout_rejected', 'payout_approved', 'payout_failed', 'event_published', 'event_sold_out', 'system');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'awaiting_verification', 'paid', 'completed', 'cancelled', 'refunded', 'expired');--> statement-breakpoint
CREATE TYPE "public"."payout_method" AS ENUM('ecocash', 'bank_usd', 'bank_zar', 'cash');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'approved', 'processing', 'paid', 'held', 'rejected', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."platform_env" AS ENUM('dev', 'stage', 'prod');--> statement-breakpoint
CREATE TYPE "public"."promo_code_type" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('security', 'usher', 'dj_sound', 'bar_staff', 'vip_host', 'media', 'other');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('available', 'reserved', 'sold', 'used', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('attendee', 'organizer', 'vendor', 'admin', 'transport_operator', 'dispatcher', 'driver', 'conductor');--> statement-breakpoint
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
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" "analytics_event" NOT NULL,
	"event_id" uuid NOT NULL,
	"organizer_id" text,
	"order_id" uuid,
	"session_id" text,
	"buyer_email" text,
	"payment_method" text,
	"ticket_type" text,
	"amount" numeric(10, 2),
	"referrer" text,
	"user_agent" text,
	"source" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "email_verification_tokens_token_hash_unique" UNIQUE("token_hash")
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
CREATE TABLE "event_lineup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"bio" text,
	"image_url" text,
	"social_url" text,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_moderation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"admin_id" text,
	"action" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_organisers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"invited_by" text NOT NULL,
	"role" text DEFAULT 'editor',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "event_waitlist_email_unique" UNIQUE("email")
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
	"google_maps_url" text,
	"tags" json DEFAULT '[]'::json,
	"featured" boolean DEFAULT false,
	"sponsored" boolean DEFAULT false,
	"sponsor_name" text,
	"sponsor_logo_url" text,
	"sponsored_at" timestamp,
	"sponsorship_expires_at" timestamp,
	"design_request_pending" boolean DEFAULT false,
	"design_brief" text,
	"design_logo_url" text,
	"design_delivered" boolean DEFAULT false,
	"hide_organizer_name" boolean DEFAULT false,
	"faq" text,
	"promo_images" json DEFAULT '[]'::json,
	"absorb_fee" boolean DEFAULT false,
	"meta_title" text,
	"meta_description" text,
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
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"read" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
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
	"user_id" text,
	"event_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'pending',
	"total_amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD',
	"payment_method" text,
	"payment_ref" text,
	"paid_at" timestamp,
	"guest_email" text,
	"guest_name" text,
	"guest_phone" text,
	"verification_sent_at" timestamp,
	"verification_expires" timestamp,
	"verified_at" timestamp,
	"completed_at" timestamp,
	"completed_by" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organiser_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"invited_by" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'editor',
	"token" text NOT NULL,
	"status" "invite_status" DEFAULT 'pending',
	"accepted_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "organiser_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "organizer_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD',
	"duration_hours" integer,
	"features" json DEFAULT '[]'::json,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "organizer_packages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "past_announce_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"recipient_email" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"transaction_trace" text NOT NULL,
	"sales_order_trace" text NOT NULL,
	"invoice_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD',
	"processor" text NOT NULL,
	"velocity_poll_status" text,
	"local_status" text NOT NULL,
	"source" text NOT NULL,
	"raw_payload" json,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payout_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payout_id" uuid NOT NULL,
	"action" text NOT NULL,
	"from_status" "payout_status",
	"to_status" "payout_status",
	"performed_by" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_id" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"method" "payout_method" DEFAULT 'ecocash' NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"account_number" text,
	"account_name" text,
	"bank_name" text,
	"rejection_reason" text,
	"proof_reference" text,
	"reviewed_by" text,
	"processed_at" timestamp,
	"processed_by" text,
	"notes" text,
	"balance_snapshot" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "platform_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" json NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now(),
	"version" integer DEFAULT 1,
	"env" "platform_env" DEFAULT 'prod' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"code" text NOT NULL,
	"type" "promo_code_type" NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"max_uses" integer DEFAULT 0,
	"used_count" integer DEFAULT 0,
	"min_purchase_amount" numeric(10, 2) DEFAULT '0',
	"expires_at" timestamp,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"order_id" uuid,
	"reviewer_name" text NOT NULL,
	"reviewer_email" text NOT NULL,
	"rating" integer NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"source" text DEFAULT 'public_link',
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"public_consent" boolean DEFAULT true NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "ticket_question_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"response" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticket_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"question" text NOT NULL,
	"required" boolean DEFAULT false,
	"scope" text DEFAULT 'order',
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticket_scan_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid,
	"event_id" uuid,
	"order_id" uuid,
	"scanner_user_id" text,
	"raw_code" text NOT NULL,
	"outcome" text NOT NULL,
	"reason" text,
	"source" text DEFAULT 'organizer_web',
	"user_agent" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
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
	"early_bird_price" numeric(10, 2),
	"early_bird_until" timestamp,
	"early_bird_quantity" integer,
	"group_price" numeric(10, 2),
	"group_min_qty" integer DEFAULT 4,
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
	"is_staff_ticket" boolean DEFAULT false,
	"staff_role" "staff_role",
	"staff_name" text,
	"staff_phone" text,
	"transfer_token" text,
	"transfer_to_email" text,
	"transfer_to_name" text,
	"transfer_expires_at" timestamp,
	"transferred_at" timestamp,
	"holder_name" text,
	"holder_email" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tickets_qr_code_unique" UNIQUE("qr_code"),
	CONSTRAINT "tickets_transfer_token_unique" UNIQUE("transfer_token")
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
	"rejected_at" timestamp,
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
	"organizer_slug" text,
	"organizer_bio" text,
	"password_hash" text,
	"commission_rate" numeric(5, 2) DEFAULT '6.00',
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_organizer_slug_unique" UNIQUE("organizer_slug")
);
--> statement-breakpoint
CREATE TABLE "velocity_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"settlement_date" timestamp NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"reference" text NOT NULL,
	"notes" text,
	"recorded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
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
	"rejected_at" timestamp,
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
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_galleries" ADD CONSTRAINT "event_galleries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_galleries" ADD CONSTRAINT "event_galleries_photographer_id_users_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_lineup" ADD CONSTRAINT "event_lineup_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_moderation_log" ADD CONSTRAINT "event_moderation_log_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_moderation_log" ADD CONSTRAINT "event_moderation_log_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_organisers" ADD CONSTRAINT "event_organisers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_organisers" ADD CONSTRAINT "event_organisers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_organisers" ADD CONSTRAINT "event_organisers_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_photos" ADD CONSTRAINT "gallery_photos_gallery_id_event_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."event_galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merch_items" ADD CONSTRAINT "merch_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merch_items" ADD CONSTRAINT "merch_items_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tier_id_ticket_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."ticket_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organiser_invites" ADD CONSTRAINT "organiser_invites_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organiser_invites" ADD CONSTRAINT "organiser_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "past_announce_log" ADD CONSTRAINT "past_announce_log_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_ledger" ADD CONSTRAINT "payment_ledger_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_ledger" ADD CONSTRAINT "payment_ledger_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_audit_log" ADD CONSTRAINT "payout_audit_log_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_downloads" ADD CONSTRAINT "photo_downloads_gallery_id_event_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."event_galleries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_downloads" ADD CONSTRAINT "photo_downloads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_downloads" ADD CONSTRAINT "photo_downloads_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shuttle_routes" ADD CONSTRAINT "shuttle_routes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shuttle_routes" ADD CONSTRAINT "shuttle_routes_operator_id_transport_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."transport_operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_question_responses" ADD CONSTRAINT "ticket_question_responses_question_id_ticket_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."ticket_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_question_responses" ADD CONSTRAINT "ticket_question_responses_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_questions" ADD CONSTRAINT "ticket_questions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_scan_logs" ADD CONSTRAINT "ticket_scan_logs_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_scan_logs" ADD CONSTRAINT "ticket_scan_logs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_scan_logs" ADD CONSTRAINT "ticket_scan_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_scan_logs" ADD CONSTRAINT "ticket_scan_logs_scanner_user_id_users_id_fk" FOREIGN KEY ("scanner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_tiers" ADD CONSTRAINT "ticket_tiers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tier_id_ticket_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."ticket_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_bookings" ADD CONSTRAINT "transport_bookings_route_id_shuttle_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."shuttle_routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_bookings" ADD CONSTRAINT "transport_bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_bookings" ADD CONSTRAINT "transport_bookings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_operators" ADD CONSTRAINT "transport_operators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "velocity_settlements" ADD CONSTRAINT "velocity_settlements_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_listings" ADD CONSTRAINT "vendor_listings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_listings" ADD CONSTRAINT "vendor_listings_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_listings" ADD CONSTRAINT "vendor_listings_booked_by_id_users_id_fk" FOREIGN KEY ("booked_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_event_id_idx" ON "analytics_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "analytics_events_order_id_idx" ON "analytics_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "analytics_events_session_id_idx" ON "analytics_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "analytics_events_event_type_idx" ON "analytics_events" USING btree ("event","created_at");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_galleries_event_id_idx" ON "event_galleries" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_lineup_event_id_idx" ON "event_lineup" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_moderation_log_event_id_idx" ON "event_moderation_log" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_organisers_event_user_idx" ON "event_organisers" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "event_organisers_event_id_idx" ON "event_organisers" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_organisers_user_id_idx" ON "event_organisers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "events_organizer_id_idx" ON "events" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "events_status_idx" ON "events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gallery_photos_gallery_id_idx" ON "gallery_photos" USING btree ("gallery_id");--> statement-breakpoint
CREATE INDEX "merch_items_event_id_idx" ON "merch_items" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_read_idx" ON "notifications" USING btree ("read");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_event_id_idx" ON "orders" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "orders_guest_email_idx" ON "orders" USING btree ("guest_email");--> statement-breakpoint
CREATE INDEX "orders_status_event_idx" ON "orders" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "orders_metadata_gin_idx" ON "orders" USING gin ("metadata");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_paid_at_idx" ON "orders" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "organiser_invites_event_id_idx" ON "organiser_invites" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "organiser_invites_token_idx" ON "organiser_invites" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "organiser_invites_event_email_idx" ON "organiser_invites" USING btree ("event_id","email");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "past_announce_log_event_email_idx" ON "past_announce_log" USING btree ("event_id","recipient_email");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_ledger_trace_idx" ON "payment_ledger" USING btree ("transaction_trace");--> statement-breakpoint
CREATE INDEX "payment_ledger_order_idx" ON "payment_ledger" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payment_ledger_event_idx" ON "payment_ledger" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "payment_ledger_created_idx" ON "payment_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payout_audit_log_payout_id_idx" ON "payout_audit_log" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "payout_audit_log_created_idx" ON "payout_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payouts_user_idx" ON "payouts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payouts_created_idx" ON "payouts" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_settings_key_env_idx" ON "platform_settings" USING btree ("key","env");--> statement-breakpoint
CREATE UNIQUE INDEX "promo_codes_code_event_idx" ON "promo_codes" USING btree ("code","event_id");--> statement-breakpoint
CREATE INDEX "reviews_event_id_idx" ON "reviews" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "reviews_order_id_idx" ON "reviews" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "reviews_status_idx" ON "reviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reviews_created_at_idx" ON "reviews" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "shuttle_routes_event_id_idx" ON "shuttle_routes" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_question_responses_question_id_idx" ON "ticket_question_responses" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "ticket_question_responses_order_id_idx" ON "ticket_question_responses" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ticket_questions_event_id_idx" ON "ticket_questions" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_scan_logs_ticket_id_idx" ON "ticket_scan_logs" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_scan_logs_event_id_idx" ON "ticket_scan_logs" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_scan_logs_order_id_idx" ON "ticket_scan_logs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ticket_scan_logs_scanner_user_id_idx" ON "ticket_scan_logs" USING btree ("scanner_user_id");--> statement-breakpoint
CREATE INDEX "ticket_scan_logs_created_at_idx" ON "ticket_scan_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ticket_tiers_event_id_idx" ON "ticket_tiers" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "tickets_event_id_idx" ON "tickets" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "tickets_user_id_idx" ON "tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tickets_order_id_idx" ON "tickets" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "tickets_staff_event_idx" ON "tickets" USING btree ("event_id","is_staff_ticket");--> statement-breakpoint
CREATE INDEX "tickets_scanned_at_idx" ON "tickets" USING btree ("scanned_at");--> statement-breakpoint
CREATE INDEX "transport_bookings_route_id_idx" ON "transport_bookings" USING btree ("route_id");--> statement-breakpoint
CREATE INDEX "transport_bookings_user_id_idx" ON "transport_bookings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "velocity_settlements_reference_idx" ON "velocity_settlements" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "velocity_settlements_date_idx" ON "velocity_settlements" USING btree ("settlement_date");--> statement-breakpoint
CREATE INDEX "velocity_settlements_created_idx" ON "velocity_settlements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "velocity_settlements_event_idx" ON "velocity_settlements" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "vendor_listings_event_id_idx" ON "vendor_listings" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "vendor_listings_vendor_id_idx" ON "vendor_listings" USING btree ("vendor_id");