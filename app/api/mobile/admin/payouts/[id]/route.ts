import { NextResponse } from "next/server"
import { z } from "zod"
import { authenticateOrganizer, privateHeaders } from "@/lib/mobile-organizer"
import { PAYABLE_FROM, transitionPayout } from "@/lib/payout-transitions"

type Context = { params: Promise<{ id: string }> }
const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: privateHeaders })
const Input = z.object({
  action: z.enum(["approve", "reject", "processing", "paid"]),
  reason: z.string().trim().min(5).max(500).optional(),
  proofReference: z.string().trim().min(3).max(200).optional(),
})

export async function POST(request: Request, context: Context) {
  const identity = await authenticateOrganizer(request)
  if (!identity.ok) return respond(identity, identity.status)
  if (identity.role !== "admin") return respond({ ok: false, error: "Admin access required" }, 403)
  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) return respond({ ok: false, error: "Invalid payout ID" }, 400)
  const parsed = Input.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return respond({ ok: false, error: "Choose a valid payout action and provide required details." }, 400)
  const performedBy = identity.email ?? identity.userId
  const action = parsed.data.action
  if (action === "reject" && !parsed.data.reason) return respond({ ok: false, error: "A rejection reason is required." }, 400)
  if (action === "paid" && !parsed.data.proofReference) return respond({ ok: false, error: "Add the transfer or receipt reference before marking a payout paid." }, 400)
  const result = await transitionPayout({
    payoutId: id,
    action,
    allowedFrom: action === "approve" || action === "reject" ? ["pending"] : action === "processing" ? ["approved"] : PAYABLE_FROM,
    toStatus: action === "approve" ? "approved" : action === "reject" ? "rejected" : action,
    performedBy,
    extraSet: action === "approve" ? { reviewedBy: performedBy } : action === "reject" ? { rejectionReason: parsed.data.reason, reviewedBy: performedBy } : action === "paid" ? { proofReference: parsed.data.proofReference, processedAt: new Date(), processedBy: performedBy } : undefined,
    auditNotes: action === "reject" ? `Rejected: ${parsed.data.reason}` : parsed.data.proofReference ? `Proof reference: ${parsed.data.proofReference}` : undefined,
    notify: action === "approve" ? { type: "payout_approved", title: "Payout approved", body: (p) => `Your payout of ${Number(p.amount).toFixed(2)} ${p.currency ?? "USD"} has been approved and is being processed.` } : action === "reject" ? { type: "payout_rejected", title: "Payout rejected", body: (p) => `Your payout of ${Number(p.amount).toFixed(2)} ${p.currency ?? "USD"} was rejected. Reason: ${parsed.data.reason}` } : action === "paid" ? { type: "payout_paid", title: "Payout sent", body: (p) => `Your payout of ${Number(p.amount).toFixed(2)} ${p.currency ?? "USD"} has been sent.` } : undefined,
  })
  if (!result.ok) return respond({ ok: false, error: result.error === "wrong_status" ? "This payout has already changed status." : "Payout not found." }, result.error === "not_found" ? 404 : 409)
  return respond({ ok: true, message: `Payout ${action} successfully.` })
}
