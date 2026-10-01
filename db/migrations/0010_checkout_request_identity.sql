CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_request_identity_idx
ON orders ((metadata->>'checkoutRequestId'))
WHERE metadata->>'checkoutRequestId' IS NOT NULL;

--> statement-breakpoint
ALTER TABLE whatsapp_checkout_sessions ADD COLUMN IF NOT EXISTS checkout_metadata jsonb;
