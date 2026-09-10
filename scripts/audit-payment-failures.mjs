// Read-only audit: no polling, workflow updates, email, or order mutations.
import pg from "pg"
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 20000 })
try {
  await pool.query("SET default_transaction_read_only = on")
  const { rows } = await pool.query(`
    SELECT id, status, payment_method, total_amount, currency, created_at,
           metadata->'velocity' AS velocity
    FROM orders WHERE created_at >= now() - interval '14 days'
      AND payment_method LIKE 'velocity-%'
      AND status IN ('pending','awaiting_verification','expired','cancelled')
    ORDER BY created_at DESC LIMIT 50
  `)
  for (let offset = 0; offset < rows.length; offset += 3) {
    await Promise.all(rows.slice(offset, offset + 3).map(async (o) => {
      const v = o.velocity ?? {}
      const summary = { id: o.id, status: o.status, method: o.payment_method, amount: o.total_amount,
        tracePresent: Boolean(v.transactionTrace), maxPoll: /poll attempts/i.test(v.lastProviderError ?? ""),
        errors: v.consecutiveProviderErrors, callback: Boolean(v.callbackProcessedAt) }
      if (!v.salesOrderId) { console.log(JSON.stringify({ ...summary, lookup: "no sales-order ID" })); return }
      try {
        const r = await fetch(`${process.env.VELOCITY_BASE_URL ?? "https://api.velocityafrica.net"}/sales-orders/${encodeURIComponent(v.salesOrderId)}`, {
          headers: { "x-api-key": process.env.VELOCITY_API_KEY }, signal: AbortSignal.timeout(15000),
        })
        const d = await r.json()
        console.log(JSON.stringify({ ...summary, http: r.status, remoteStatus: d.status,
          paid: d.paidAmount, outstanding: d.outstandingAmount, total: d.grandTotal,
          refsMatch: d.id === v.salesOrderId && d.trace === v.salesOrderTrace,
          currency: d.currencyCodeString }))
      } catch (error) { console.log(JSON.stringify({ ...summary, error: error.message })) }
    }))
  }
  const manual = await pool.query(`SELECT payment_method,
    count(*) FILTER (WHERE metadata->'manualCompletion' IS NOT NULL OR metadata->'velocity'->>'manualCompletionAt' IS NOT NULL) AS manual,
    count(*) FILTER (WHERE metadata->'velocity'->>'callbackProcessedAt' IS NOT NULL) AS callbacks,
    count(*) FILTER (WHERE metadata->'delivery'->>'emailSentAt' IS NOT NULL) AS emailed
    FROM orders WHERE created_at >= now()-interval '14 days' AND payment_method LIKE 'velocity-%' GROUP BY payment_method`)
  console.log(JSON.stringify({ completionEvidence: manual.rows }))
} finally { await pool.end() }
