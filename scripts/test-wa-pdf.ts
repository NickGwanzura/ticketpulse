/**
 * Sends a test ticket PDF to the admin WhatsApp number.
 * Picks the most recent paid/completed order that has tickets.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/test-wa-pdf.ts
 */
import { neon } from "@neondatabase/serverless"
import QRCode from "qrcode"
import { generateTicketPdfBuffer } from "../lib/pdf/generate"

const DB_URL = process.env.DATABASE_URL
const ADMIN_PHONE = process.env.ADMIN_PHONE
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
const OPENWA_URL = process.env.OPENWA_URL
const OPENWA_API_KEY = process.env.OPENWA_API_KEY
const OPENWA_SESSION_ID = process.env.OPENWA_SESSION_ID

if (!DB_URL) { console.error("Missing DATABASE_URL"); process.exit(1) }
if (!ADMIN_PHONE) { console.error("Missing ADMIN_PHONE"); process.exit(1) }
if (!OPENWA_URL || !OPENWA_API_KEY || !OPENWA_SESSION_ID) {
  console.error("Missing OPENWA_URL / OPENWA_API_KEY / OPENWA_SESSION_ID")
  process.exit(1)
}

function formatChatId(phone: string): string {
  let digits = phone.replace(/\D/g, "")
  if (digits.startsWith("0")) digits = digits.slice(1)
  return `${digits}@c.us`
}

async function openwaPost(path: string, body: unknown) {
  const res = await fetch(`${OPENWA_URL!.replace(/\/+$/, "")}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": OPENWA_API_KEY! },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown")
    throw new Error(`OpenWA ${res.status}: ${text}`)
  }
  return res.json()
}

async function main() {
  const sql = neon(DB_URL!)

  console.log("Checking WhatsApp session…")
  const sessionRes = await fetch(
    `${OPENWA_URL!.replace(/\/+$/, "")}/api/sessions/${OPENWA_SESSION_ID}`,
    { headers: { "X-API-Key": OPENWA_API_KEY! } },
  )
  const session = await sessionRes.json() as { status?: string }
  if (session.status !== "ready") {
    console.error("WhatsApp session not ready:", session.status)
    process.exit(1)
  }
  console.log("Session ready ✓")

  // Find most recent paid/completed order that has tickets
  const orderRows = await sql`
    SELECT o.id, o.guest_name, o.event_id, o.total_amount, o.currency
    FROM orders o
    WHERE o.status IN ('paid', 'completed')
      AND EXISTS (
        SELECT 1 FROM tickets t
        WHERE t.order_id = o.id
          AND t.status NOT IN ('cancelled', 'refunded')
      )
    ORDER BY o.created_at DESC
    LIMIT 1
  `

  if (!orderRows.length) { console.error("No eligible orders found"); process.exit(1) }
  const order = orderRows[0]
  const orderId = order.id as string
  console.log(`Using order ${orderId.slice(0, 8)}… (${order.guest_name})`)

  // Load event
  const evRows = await sql`
    SELECT title, starts_at, venue FROM events WHERE id = ${order.event_id} LIMIT 1
  `
  const ev = evRows[0]

  // Load tickets
  const ticketRows = await sql`
    SELECT t.id, t.qr_code, t.tier_id
    FROM tickets t
    WHERE t.order_id = ${orderId}
      AND t.status NOT IN ('cancelled', 'refunded')
  `

  // Load tier names
  const tierIds = [...new Set(ticketRows.map((t: Record<string, unknown>) => t.tier_id as string).filter(Boolean))]
  const tierMap = new Map<string, string>()
  if (tierIds.length) {
    const tierRows = await sql`SELECT id, name FROM ticket_tiers WHERE id = ANY(${tierIds})`
    for (const t of tierRows) tierMap.set(t.id as string, t.name as string)
  }

  // Build PDF pages
  const ticketPages = await Promise.all(
    ticketRows.map(async (t: Record<string, unknown>, idx: number) => {
      const verifyUrl = `${APP_URL}/tickets/${t.id}/verify?order=${orderId}`
      const qrVal = t.qr_code as string | null
      const qrCodeDataUrl = qrVal?.startsWith("data:image")
        ? qrVal
        : await QRCode.toDataURL(qrVal ?? verifyUrl, { width: 200, margin: 2 })

      const startsAt = ev?.starts_at as string | null
      return {
        eventTitle: (ev?.title as string) ?? "Your Event",
        tierName: tierMap.get(t.tier_id as string) ?? "General Admission",
        buyerName: (order.guest_name as string) ?? "Valued Guest",
        orderId,
        ticketId: t.id as string,
        qrCodeDataUrl,
        humanCode: `${orderId.slice(-6)}-${(idx + 1).toString().padStart(2, "0")}`,
        venue: ev?.venue as string | null,
        eventDate: startsAt
          ? new Date(startsAt).toLocaleString("en-GB", {
              weekday: "long", day: "numeric", month: "long",
              year: "numeric", hour: "2-digit", minute: "2-digit",
              timeZone: "Africa/Harare",
            })
          : null,
      }
    }),
  )

  console.log(`Generating PDF for ${ticketPages.length} ticket(s)…`)
  const pdfBuffer = await generateTicketPdfBuffer(ticketPages)
  const pdfBase64 = Buffer.from(pdfBuffer).toString("base64")
  console.log(`PDF generated (${Math.round(pdfBuffer.byteLength / 1024)} KB) ✓`)

  const chatId = formatChatId(ADMIN_PHONE!)
  const sid = OPENWA_SESSION_ID

  console.log(`Sending to admin WA (${ADMIN_PHONE})…`)

  const startsAt = ev?.starts_at as string | null
  const eventDate = startsAt
    ? new Date(startsAt).toLocaleString("en-GB", {
        weekday: "long", day: "numeric", month: "long",
        year: "numeric", hour: "2-digit", minute: "2-digit",
        timeZone: "Africa/Harare",
      })
    : "TBA"

  const textLines = [
    `*[TEST] Ticket Delivery*`,
    ``,
    `Order: #${orderId.slice(0, 8)}`,
    `Event: ${ev?.title ?? "N/A"}`,
    `Date: ${eventDate}`,
    ev?.venue ? `Venue: ${ev.venue}` : null,
    ``,
    ticketPages.map((p) => `  • 1× ${p.tierName}`).join("\n"),
    ``,
    `View tickets: ${APP_URL}/orders/${orderId}`,
  ].filter(Boolean).join("\n")

  await openwaPost(`/sessions/${sid}/messages/send-text`, { chatId, text: textLines })
  console.log("Text sent ✓")

  await openwaPost(`/sessions/${sid}/messages/send-document`, {
    chatId,
    base64: pdfBase64,
    mimetype: "application/pdf",
    filename: `tickets-${orderId.slice(0, 8)}.pdf`,
    caption: "Your ticket PDF — show the QR code at the door.",
  })
  console.log("PDF sent ✓")
  console.log("Done.")
}

main().catch((err) => { console.error(err); process.exit(1) })
