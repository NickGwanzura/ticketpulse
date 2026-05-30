"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { platformSettings } from "@/db/schema"
import { log } from "@/lib/logger"

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001"

export async function getPlatformSettings() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const [settings] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, SETTINGS_ID))
    .limit(1)

  if (!settings) {
    // Seed default settings if missing
    const [created] = await db
      .insert(platformSettings)
      .values({ id: SETTINGS_ID })
      .returning()
    return created
  }

  return settings
}

export async function updatePlatformSettings(formData: FormData) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const platformName = formData.get("platformName") as string
  const supportEmail = formData.get("supportEmail") as string
  const defaultCurrency = formData.get("defaultCurrency") as string
  const platformFeePercent = parseFloat(formData.get("platformFeePercent") as string)
  const maintenanceMode = formData.get("maintenanceMode") === "on"

  if (!platformName || !supportEmail || !defaultCurrency || Number.isNaN(platformFeePercent)) {
    throw new Error("Invalid form data")
  }

  await db
    .update(platformSettings)
    .set({
      platformName: platformName.trim(),
      supportEmail: supportEmail.trim(),
      defaultCurrency: defaultCurrency.trim(),
      platformFeePercent: platformFeePercent.toFixed(2),
      maintenanceMode,
      updatedAt: new Date(),
    })
    .where(eq(platformSettings.id, SETTINGS_ID))

  log.info("Platform settings updated", { by: session.user.email })
  revalidatePath("/admin/settings")
  return { ok: true }
}
