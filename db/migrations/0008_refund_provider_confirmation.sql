ALTER TYPE "public"."ticket_status" ADD VALUE 'refund_pending';--> statement-breakpoint
CREATE TYPE "public"."refund_request_status" AS ENUM('requested', 'approved', 'rejected', 'confirmed', 'failed');--> statement-breakpoint
CREATE TABLE "refund_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"status" "refund_request_status" DEFAULT 'requested' NOT NULL,
	"source" text DEFAULT 'buyer' NOT NULL,
	"requested_by_email" text NOT NULL,
	"reason" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"outside_standard_window" boolean DEFAULT false NOT NULL,
	"external_key" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"review_note" text,
	"provider_reference" text,
	"provider_confirmed_by" text,
	"provider_confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "refund_requests_order_idx" ON "refund_requests" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refund_requests_event_status_idx" ON "refund_requests" USING btree ("event_id", "status");--> statement-breakpoint
CREATE INDEX "refund_requests_status_created_idx" ON "refund_requests" USING btree ("status", "created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "refund_requests_external_key_idx" ON "refund_requests" USING btree ("external_key");--> statement-breakpoint
CREATE UNIQUE INDEX "refund_requests_provider_reference_idx" ON "refund_requests" USING btree ("provider_reference");--> statement-breakpoint
CREATE TABLE "refund_request_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"refund_request_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "refund_request_tickets" ADD CONSTRAINT "refund_request_tickets_refund_request_id_refund_requests_id_fk" FOREIGN KEY ("refund_request_id") REFERENCES "public"."refund_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_request_tickets" ADD CONSTRAINT "refund_request_tickets_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "refund_request_tickets_request_ticket_idx" ON "refund_request_tickets" USING btree ("refund_request_id", "ticket_id");--> statement-breakpoint
CREATE INDEX "refund_request_tickets_ticket_idx" ON "refund_request_tickets" USING btree ("ticket_id");
