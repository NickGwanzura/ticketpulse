import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { vendors } from "@/db/schema"
import { sendEmail, adminEmail } from "@/lib/email"
import { vendorEnquiryEmail } from "@/lib/email-templates"

const BodySchema = z.object({
  vendorId: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  email: z.email(),
  phone: z.string().max(40).optional().nullable(),
  message: z.string().min(10).max(4000),
  eventDate: z.string().max(40).optional().nullable(),
  guestCount: z.union([z.string().max(20), z.number()]).optional().nullable(),
})

// Treat ids that look like uuids as DB lookups; everything else is an
// in-memory slug (the static VENDORS array doesn't expose a real id yet).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { vendorId, name, email, phone, message, eventDate, guestCount } = parsed.data

  let vendorEmail: string | null = null
  let vendorName = "Vendor"

  if (UUID_RE.test(vendorId) && process.env.DATABASE_URL) {
    try {
      const [vendor] = await db
        .select({
          email: vendors.email,
          businessName: vendors.businessName,
        })
        .from(vendors)
        .where(eq(vendors.id, vendorId))
        .limit(1)
      if (vendor) {
        vendorEmail = vendor.email
        vendorName = vendor.businessName
      }
    } catch (err) {
      console.warn("[vendor enquire] db lookup", err)
    }
  }

  const built = vendorEnquiryEmail({
    vendorName,
    customerName: name,
    customerEmail: email,
    customerPhone: phone ?? null,
    eventDate: eventDate ?? null,
    guestCount: guestCount ?? null,
    message,
  })

  // If the vendor has no reachable email, fall back to admin only.
  const to = vendorEmail ?? adminEmail
  const cc = vendorEmail ? adminEmail : undefined

  try {
    await sendEmail({
      to,
      cc,
      subject: `New enquiry for ${vendorName}`,
      html: built.html,
      text: built.text,
      replyTo: email,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const messageOut = err instanceof Error ? err.message : "Failed to send"
    return NextResponse.json({ error: messageOut }, { status: 502 })
  }
}
