import { z } from "zod"
import { formatPhone } from "@/lib/velocity/validation"

export const CheckoutBody = z.object({
  email: z.string().trim().email().toLowerCase(), name: z.string().trim().min(1).max(120),
  phone: z.string().max(40).trim().optional().default(""),
  paymentMethod: z.enum(["velocity-ecocash", "velocity-card"]), eventSlug: z.string().min(1).max(160),
  items: z.array(z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("ticket"), tierId: z.string().uuid(), quantity: z.number().int().positive().max(50) }),
    z.object({ kind: z.literal("vendor_addon"), listingId: z.string().uuid(), quantity: z.number().int().positive().max(10) }),
    z.object({ kind: z.literal("merch"), itemId: z.string().uuid(), quantity: z.number().int().positive().max(10), size: z.string().max(40).optional() }),
  ])).min(1).max(30),
  questionResponses: z.record(z.string().uuid(), z.string().max(2000)).optional(),
  checkoutRequestId: z.string().uuid(), quoteOnly: z.boolean().optional().default(false),
  expectedAmount: z.number().finite().nonnegative().optional(), expectedCurrency: z.enum(["USD", "ZWG"]).optional(),
})
export type CheckoutInput = z.infer<typeof CheckoutBody>
export function checkoutFingerprint(input: CheckoutInput, eventId: string, amount: number, currency: string): string {
  return JSON.stringify({ eventId, email: input.email, paymentMethod: input.paymentMethod,
    phone: input.paymentMethod === "velocity-ecocash" ? formatPhone(input.phone) : "", currency,
    total: amount.toFixed(2), items: input.items.map(i => JSON.stringify(i)).sort(),
    questions: Object.entries(input.questionResponses ?? {}).sort(),
  })
}
export function quoteMatches(input: Pick<CheckoutInput, "expectedAmount" | "expectedCurrency">, amount: number, currency: string) {
  return input.expectedAmount !== undefined && Math.round(input.expectedAmount * 100) === Math.round(amount * 100) && input.expectedCurrency === currency
}
