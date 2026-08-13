import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getAdminPaymentsData, type PaymentsApiResponse } from "@/lib/admin-payments"

export type { PaymentsApiResponse }

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1)
  return NextResponse.json(await getAdminPaymentsData(page))
}
