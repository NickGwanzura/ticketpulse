import { NextResponse } from "next/server"
import { z } from "zod"
import { authenticateOrganizer, privateHeaders } from "@/lib/mobile-organizer"
import { buildOrderTicketsPdf } from "@/lib/order-pdf"
import { rateLimit } from "@/lib/rate-limit"

type Context = { params: Promise<{ id: string }> }
const limiter = rateLimit({ windowMs: 60_000, max: 20 })
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: privateHeaders })

/** Support download of an order's ticket PDF so it can be shared by hand. Admin only. */
export async function GET(request: Request, context: Context) {
  const identity = await authenticateOrganizer(request)
  if (!identity.ok) return fail(identity.error, identity.status)
  if (identity.role !== "admin") return fail("Admin access required", 403)
  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) return fail("Invalid order ID", 400)
  if (!(await limiter.checkDistributed(identity.userId)).allowed) return fail("Too many downloads. Please wait a minute.", 429)

  const result = await buildOrderTicketsPdf(id)
  if (!result.ok) return fail(result.error, result.status)
  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      ...privateHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  })
}
