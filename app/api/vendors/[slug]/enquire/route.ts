import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { users, vendors, vendorEnquiries } from "@/db/schema"
import { sendEmail, adminEmail } from "@/lib/email"
import { vendorEnquiryEmail } from "@/lib/email-templates"
import { rateLimit } from "@/lib/rate-limit"

const BodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  phone: z.string().trim().min(5).max(40).optional(),
  message: z.string().trim().min(10).max(4000),
  eventDate: z.iso.date().refine(
    (value) => new Date(`${value}T23:59:59+02:00`) >= new Date(),
    "Choose today or a future date",
  ),
  guestCount: z.number().int().positive().max(100000).optional(),
})

const enquiryLimiter = rateLimit({ windowMs: 60_000, max: 5 })

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const limit = await enquiryLimiter.checkRequest(req)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    )
  }

  const { slug } = await params
  if (!z.uuid().safeParse(slug).success) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
  }

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

  const { name, email, phone, message, eventDate, guestCount } = parsed.data
  let vendor: { email: string | null; businessName: string; accountEmail: string | null; accountEmailVerified: Date | null } | undefined

  try {
    ;[vendor] = await db
      .select({ email: vendors.email, businessName: vendors.businessName, accountEmail: users.email, accountEmailVerified: users.emailVerified })
      .from(vendors)
      .leftJoin(users, eq(vendors.userId, users.id))
      .where(and(eq(vendors.id, slug), eq(vendors.verified, true)))
      .limit(1)

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
    }

    await db.insert(vendorEnquiries).values({
      vendorId: slug,
      name,
      email,
      phone: phone ?? null,
      eventDate,
      guestCount: guestCount == null ? null : String(guestCount),
      message,
    })
  } catch (err) {
    console.error("[vendor enquire] failed to save request", err)
    return NextResponse.json({ error: "We could not save your request. Please try again." }, { status: 503 })
  }

  const built = vendorEnquiryEmail({
    vendorName: vendor.businessName,
    customerName: name,
    customerEmail: email,
    customerPhone: phone ?? null,
    eventDate,
    guestCount: guestCount ?? null,
    message,
  })

  // Booking details leave the app only for a verified address owned by the vendor account.
  // Legacy listings with an unverified or mismatched contact email stay visible in the
  // vendor dashboard; the admin receives the notification instead.
  const verifiedEmail = vendor.accountEmailVerified && vendor.accountEmail &&
    vendor.email?.toLowerCase() === vendor.accountEmail.toLowerCase()
    ? vendor.accountEmail : null
  const to = verifiedEmail ?? adminEmail
  const cc = verifiedEmail ? adminEmail : undefined

  try {
    const result = await sendEmail({
      to,
      cc,
      subject: `New booking request for ${vendor.businessName}`,
      html: built.html,
      text: built.text,
      replyTo: email,
    })
    return NextResponse.json({ ok: true, notificationSent: !("skipped" in result) })
  } catch (err) {
    console.error("[vendor enquire] saved request but notification failed", err)
    return NextResponse.json({ ok: true, notificationSent: false })
  }
}
