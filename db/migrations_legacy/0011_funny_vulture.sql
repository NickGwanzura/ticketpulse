CREATE TYPE "public"."analytics_event" AS ENUM('EVENT_VIEWED', 'CHECKOUT_STARTED', 'BUYER_DETAILS_SUBMITTED', 'PAYMENT_METHOD_SELECTED', 'PAYMENT_INITIATED', 'PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'ORDER_ABANDONED', 'TICKET_ISSUED', 'TICKET_CHECKED_IN');--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'expired';--> statement-breakpoint
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
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_event_id_idx" ON "analytics_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "analytics_events_order_id_idx" ON "analytics_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "analytics_events_session_id_idx" ON "analytics_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "analytics_events_event_type_idx" ON "analytics_events" USING btree ("event","created_at");