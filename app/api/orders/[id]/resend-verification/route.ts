import { NextResponse } from "next/server"
export async function POST() {
  return NextResponse.json({ error: "Verification is no longer required" }, { status: 410 })
}
