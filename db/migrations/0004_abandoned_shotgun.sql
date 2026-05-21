CREATE TYPE "public"."promo_code_type" AS ENUM('percent', 'fixed');--> statement-breakpoint
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
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "promo_codes_code_event_idx" ON "promo_codes" USING btree ("code","event_id");