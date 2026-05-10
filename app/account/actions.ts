"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { auth } from "@/auth"
import { db } from "@/db"
import { users } from "@/db/schema"

const profileSchema = z.object({
  name:  z.string().max(100).nullable(),
  image: z.string().url().nullable(),
  phone: z.string().max(30).nullable().optional(),
  bio:   z.string().max(500).nullable().optional(),
})

export async function updateAccountProfile(input: {
  name:  string | null
  image: string | null
  phone?: string | null
  bio?:   string | null
}) {
  const session = await auth()
  if (!session) throw new Error("Unauthenticated")

  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input")
  }

  const { name, image, phone, bio } = parsed.data

  await db
    .update(users)
    .set({
      name:      name  ?? null,
      image:     image ?? null,
      phone:     phone ?? null,
      bio:       bio   ?? null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id))

  revalidatePath("/account")
}
