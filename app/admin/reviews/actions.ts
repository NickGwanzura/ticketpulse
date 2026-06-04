"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { reviews } from "@/db/schema"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") redirect("/auth/signin?callbackUrl=/admin/reviews")
}

export async function approveReviewAction(reviewId: string) {
  await requireAdmin()
  await db
    .update(reviews)
    .set({ status: "approved", approvedAt: new Date(), rejectedAt: null, updatedAt: new Date() })
    .where(eq(reviews.id, reviewId))
  revalidatePath("/")
  revalidatePath("/admin/reviews")
}

export async function rejectReviewAction(reviewId: string) {
  await requireAdmin()
  await db
    .update(reviews)
    .set({ status: "rejected", rejectedAt: new Date(), featured: false, updatedAt: new Date() })
    .where(eq(reviews.id, reviewId))
  revalidatePath("/")
  revalidatePath("/admin/reviews")
}

export async function toggleFeaturedReviewAction(reviewId: string, featured: boolean) {
  await requireAdmin()
  await db
    .update(reviews)
    .set({ featured, updatedAt: new Date() })
    .where(eq(reviews.id, reviewId))
  revalidatePath("/")
  revalidatePath("/admin/reviews")
}
