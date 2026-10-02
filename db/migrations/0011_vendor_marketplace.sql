CREATE TABLE IF NOT EXISTS "vendor_packages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vendor_id" uuid NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "price" numeric(10, 2) NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL,
  "inclusions" json DEFAULT '[]'::json,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_packages_vendor_id_idx" ON "vendor_packages" USING btree ("vendor_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_packages_active_idx" ON "vendor_packages" USING btree ("vendor_id", "active");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_enquiries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vendor_id" uuid NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "event_date" text,
  "guest_count" text,
  "message" text NOT NULL,
  "status" text DEFAULT 'new' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_enquiries_vendor_id_idx" ON "vendor_enquiries" USING btree ("vendor_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_enquiries_vendor_status_idx" ON "vendor_enquiries" USING btree ("vendor_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_enquiries_created_at_idx" ON "vendor_enquiries" USING btree ("created_at");
