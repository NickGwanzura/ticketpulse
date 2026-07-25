CREATE TYPE "public"."organizer_fee_due_status" AS ENUM('outstanding', 'settled', 'waived');--> statement-breakpoint
CREATE TYPE "public"."payout_clawback_status" AS ENUM('outstanding', 'recovered', 'waived');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_checkout_step" AS ENUM('choose_event', 'quantity', 'name', 'email', 'phone', 'done', 'cancelled');--> statement-breakpoint
CREATE TABLE "organizer_fee_dues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"event_id" uuid,
	"organizer_id" text NOT NULL,
	"gross_amount" numeric(10, 2) NOT NULL,
	"fee_rate" numeric(5, 4) NOT NULL,
	"fee_amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "organizer_fee_due_status" DEFAULT 'outstanding' NOT NULL,
	"settled_at" timestamp,
	"settled_by" text,
	"note" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_clawbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"event_id" uuid,
	"organizer_id" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"reason" text NOT NULL,
	"status" "payout_clawback_status" DEFAULT 'outstanding' NOT NULL,
	"recovered_at" timestamp,
	"recovered_by" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_checkout_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" text NOT NULL,
	"step" "whatsapp_checkout_step" DEFAULT 'choose_event' NOT NULL,
	"event_id" uuid,
	"tier_id" uuid,
	"quantity" integer,
	"guest_name" text,
	"guest_email" text,
	"guest_phone" text,
	"order_id" uuid,
	"candidate_event_ids" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_checkout_sessions_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
ALTER TABLE "organizer_fee_dues" ADD CONSTRAINT "organizer_fee_dues_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_fee_dues" ADD CONSTRAINT "organizer_fee_dues_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_fee_dues" ADD CONSTRAINT "organizer_fee_dues_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_clawbacks" ADD CONSTRAINT "payout_clawbacks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_clawbacks" ADD CONSTRAINT "payout_clawbacks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_clawbacks" ADD CONSTRAINT "payout_clawbacks_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_checkout_sessions" ADD CONSTRAINT "whatsapp_checkout_sessions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_checkout_sessions" ADD CONSTRAINT "whatsapp_checkout_sessions_tier_id_ticket_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."ticket_tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_checkout_sessions" ADD CONSTRAINT "whatsapp_checkout_sessions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organizer_fee_dues_organizer_idx" ON "organizer_fee_dues" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "organizer_fee_dues_event_idx" ON "organizer_fee_dues" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "organizer_fee_dues_status_idx" ON "organizer_fee_dues" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payout_clawbacks_organizer_idx" ON "payout_clawbacks" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "payout_clawbacks_event_idx" ON "payout_clawbacks" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "payout_clawbacks_status_idx" ON "payout_clawbacks" USING btree ("status");