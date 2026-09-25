import { resendOrderTickets } from "@/lib/resend-tickets"

type Params = { id: string }

export async function POST(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params
  return resendOrderTickets(req, id, { organizerScoped: false })
}
