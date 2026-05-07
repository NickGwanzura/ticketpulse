import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { merchItems } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { auth } from "@/auth"
import { z } from "zod"

const PostSchema = z.object({
  eventId: z.uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  currency: z.string().optional(),
  images: z.array(z.url()).optional(),
  sizes: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  stockQuantity: z.int().nonnegative().optional(),
  deliveryAvailable: z.boolean().optional(),
  pickupAtEvent: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get("eventId")

  if (!eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 })
  }

  const items = await db
    .select()
    .from(merchItems)
    .where(and(eq(merchItems.eventId, eventId), eq(merchItems.active, true)))

  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "organizer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = PostSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 })
  }
  const {
    eventId,
    name,
    description,
    price,
    currency,
    images,
    sizes,
    colors,
    stockQuantity,
    deliveryAvailable,
    pickupAtEvent,
  } = parsed.data

  const [item] = await db
    .insert(merchItems)
    .values({
      eventId,
      organizerId: session.user.id,
      name,
      description,
      price: String(price),
      currency: currency ?? "USD",
      images: images ?? [],
      sizes: sizes ?? [],
      colors: colors ?? [],
      stockQuantity: stockQuantity ?? 0,
      deliveryAvailable: deliveryAvailable ?? false,
      pickupAtEvent: pickupAtEvent ?? true,
    })
    .returning()

  return NextResponse.json({ item }, { status: 201 })
}
