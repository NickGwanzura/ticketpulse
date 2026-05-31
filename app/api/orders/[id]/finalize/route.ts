import { redirect } from "next/navigation"
type Params = { id: string }
export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params
  redirect(`/orders/${id}`)
}
