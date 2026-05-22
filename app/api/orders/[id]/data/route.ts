import { NextResponse } from "next/server"
import { getOrderFromDb } from "@/lib/order-data"

type Params = { id: string }

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params
  const order = await getOrderFromDb(id)
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json(order)
}
