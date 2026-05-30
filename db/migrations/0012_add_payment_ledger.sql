CREATE TABLE IF NOT EXISTS "payment_ledger" (
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
ALTER TABLE "payment_ledger" ADD CONSTRAINT "payment_ledger_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_ledger" ADD CONSTRAINT "payment_ledger_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_ledger_trace_idx" ON "payment_ledger" USING btree ("transaction_trace");--> statement-breakpoint
CREATE INDEX "payment_ledger_order_idx" ON "payment_ledger" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payment_ledger_event_idx" ON "payment_ledger" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "payment_ledger_created_idx" ON "payment_ledger" USING btree ("created_at");
