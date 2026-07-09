CREATE TABLE IF NOT EXISTS ticket_scan_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  scanner_user_id text REFERENCES users(id) ON DELETE SET NULL,
  raw_code text NOT NULL,
  outcome text NOT NULL,
  reason text,
  source text DEFAULT 'organizer_web',
  user_agent text,
  ip_address text,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ticket_scan_logs_ticket_id_idx ON ticket_scan_logs(ticket_id);
CREATE INDEX IF NOT EXISTS ticket_scan_logs_event_id_idx ON ticket_scan_logs(event_id);
CREATE INDEX IF NOT EXISTS ticket_scan_logs_order_id_idx ON ticket_scan_logs(order_id);
CREATE INDEX IF NOT EXISTS ticket_scan_logs_scanner_user_id_idx ON ticket_scan_logs(scanner_user_id);
CREATE INDEX IF NOT EXISTS ticket_scan_logs_created_at_idx ON ticket_scan_logs(created_at);
