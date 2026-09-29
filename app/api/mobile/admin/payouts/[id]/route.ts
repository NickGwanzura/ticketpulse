import { NextResponse } from "next/server"
import { z } from "zod"
import { authenticateOrganizer, privateHeaders } from "@/lib/mobile-organizer"
import { transitionPayout } from "@/lib/payout-transitions"

type Context = { params: Promise<{ id: string }> }
const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: privateHeaders })
const Input = z.object({
  action: z.enum(["approve", "reject", "processing", "paid"]),
  reason: z.string().trim().min(5).max(500).optional(),
  proofReference: z.string().trim().min(3).max(200).optional(),
}).superRefine((value, context) => {
  if (value.action === "reject" && !value.reason) {
    context.addIssue({ code: "custom", path: ["reason"], message: "A rejection reason is required." })
  }
  if (value.action === "paid" && !value.proofReference) {
    context.addIssue({ code: "custom", path: ["proofReference"], message: "A provider proof reference is required." })
  }
})

export async function POST(request: Request, context: Context) {
  const identity = await authenticateOrganizer(request)
  if (!identity.ok) return respond(identity, identity.status)
  if (identity.role !== "admin") return respond({ ok: false, error: "Admin access required" }, 403)
  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) return respond({ ok: false, error: "Invalid payout ID" }, 400)
  const parsed = Input.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return respond({ ok: false, error: "Choose a valid payout action and provide required details." }, 400)
  const action = parsed.data.action
  const result = await transitionPayout({
    payoutId: id,
    action,
    performedBy: { userId: identity.userId, email: identity.email ?? null },
    reason: parsed.data.reason,
    proofReference: parsed.data.proofReference,
  })
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : result.error === "wrong_status" ? 409 : result.error === "invalid_details" ? 400 : 500
    return respond({ ok: false, error: result.error === "wrong_status" ? "This payout has already changed status." : result.error === "not_found" ? "Payout not found." : result.error === "invalid_details" ? "Check the payout reason or unique provider reference." : "Payout action failed." }, status)
  }
  return respond({ ok: true, message: `Payout ${action} successfully.` })
}
