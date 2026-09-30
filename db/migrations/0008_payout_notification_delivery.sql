CREATE TYPE "public"."payout_notification_channel" AS ENUM('email', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."payout_notification_delivery_status" AS ENUM('pending', 'sending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payout_notification_event" AS ENUM('payout_requested', 'payout_approved', 'payout_processing', 'payout_rejected', 'payout_paid', 'payout_failed');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'payout_processing' BEFORE 'payout_failed';--> statement-breakpoint
CREATE TABLE "payout_notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payout_id" uuid NOT NULL,
	"event_type" "payout_notification_event" NOT NULL,
	"channel" "payout_notification_channel" NOT NULL,
	"status" "payout_notification_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"last_attempt_at" timestamp,
	"locked_at" timestamp,
	"delivered_at" timestamp,
	"provider_message_id" text,
	"last_error_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "platform_fee_percent" SET DEFAULT '6.00';--> statement-breakpoint
ALTER TABLE "payout_notification_deliveries" ADD CONSTRAINT "payout_notification_deliveries_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payout_notification_delivery_event_channel_idx" ON "payout_notification_deliveries" USING btree ("payout_id","event_type","channel");--> statement-breakpoint
CREATE INDEX "payout_notification_delivery_retry_idx" ON "payout_notification_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "payout_notification_delivery_payout_idx" ON "payout_notification_deliveries" USING btree ("payout_id");
