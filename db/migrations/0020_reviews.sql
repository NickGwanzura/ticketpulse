DO $$ BEGIN
  CREATE TYPE "review_status" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews" (
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
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_event_id_events_id_fk"
  FOREIGN KEY ("event_id") REFERENCES "public"."events"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_order_id_orders_id_fk"
  FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_event_id_idx" ON "reviews" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_order_id_idx" ON "reviews" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_status_idx" ON "reviews" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_created_at_idx" ON "reviews" USING btree ("created_at");
