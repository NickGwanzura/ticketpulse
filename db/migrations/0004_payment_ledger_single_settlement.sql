-- Enforce at most one SETTLED ledger row per order.
--
-- The application guards against double-crediting with per-path SELECTs, but
-- three independent paths can each insert a settled row for the same order
-- using different synthesized traces:
--   * lib/velocity/reconciliation.ts        (real Velocity transactionTrace)
--   * lib/velocity/sales-order-recovery.ts  (sales-order:<remote id>)
--   * lib/order-recovery.ts                 (manual-complete:<orderId>)
-- `payment_ledger_trace_idx` is UNIQUE on transactionTrace only, so the
-- database could not prevent a second settled row. lib/payment-ledger-audit.ts
-- already reports MULTIPLE_PAID_LEDGER_ROWS as a critical finding — i.e. the
-- codebase can only detect the problem after the fact.
--
-- This partial unique index makes the invariant enforceable instead of
-- merely observable. Non-settled rows (pending/failed) are unconstrained, so
-- retries and probe attempts still append freely.

-- Step 1: surface any pre-existing duplicates. If this returns rows, the
-- index creation below would fail — reconcile them before proceeding rather
-- than silently deleting financial history.
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT order_id
    FROM payment_ledger
    WHERE local_status IN ('paid', 'completed', 'success', 'paid_success')
    GROUP BY order_id
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot create payment_ledger_settled_order_idx: % order(s) have multiple settled ledger rows. Run: SELECT order_id, COUNT(*) FROM payment_ledger WHERE local_status IN (''paid'',''completed'',''success'',''paid_success'') GROUP BY order_id HAVING COUNT(*) > 1; and reconcile before migrating.',
      dup_count;
  END IF;
END $$;

-- Step 2: the invariant.
CREATE UNIQUE INDEX IF NOT EXISTS payment_ledger_settled_order_idx
  ON payment_ledger (order_id)
  WHERE local_status IN ('paid', 'completed', 'success', 'paid_success');
