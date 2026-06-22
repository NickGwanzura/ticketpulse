"use server"

import { revalidatePath } from "next/cache"
import { eq, and, inArray } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { platformSettings } from "@/db/schema"
import { log } from "@/lib/logger"
import { PLATFORM_FEE_PERCENT } from "@/lib/platform-fee"

const ENV = "prod"

type SettingsMap = {
  platformName: string
  supportEmail: string
  defaultCurrency: string
  platformFeePercent: string
  maintenanceMode: boolean
  updatedAt: Date | null
}

const DEFAULTS: SettingsMap = {
  platformName: "TicketPulse",
  supportEmail: "nick@ticketpulse.co.zw",
  defaultCurrency: "USD",
  platformFeePercent: PLATFORM_FEE_PERCENT.toFixed(2),
  maintenanceMode: false,
  updatedAt: null,
}

const KEY_MAP: Record<string, keyof SettingsMap> = {
  platform_name: "platformName",
  support_email: "supportEmail",
  default_currency: "defaultCurrency",
  platform_fee_percent: "platformFeePercent",
  maintenance_mode: "maintenanceMode",
}


export async function getPlatformSettings(): Promise<SettingsMap> {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const rows = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.env, ENV))

  const settings = { ...DEFAULTS }

  let latestUpdatedAt: Date | null = null

  for (const row of rows) {
    const mappedKey = KEY_MAP[row.key]
    if (mappedKey) {
      if (mappedKey === "maintenanceMode") {
        settings.maintenanceMode = row.value === true || row.value === "true"
      } else if (mappedKey === "platformFeePercent") {
        // The fee is fixed policy; ignore stale or manually edited values.
        settings.platformFeePercent = PLATFORM_FEE_PERCENT.toFixed(2)
      } else if (mappedKey === "platformName") {
        settings.platformName = String(row.value)
      } else if (mappedKey === "supportEmail") {
        settings.supportEmail = String(row.value)
      } else if (mappedKey === "defaultCurrency") {
        settings.defaultCurrency = String(row.value)
      } else {
        settings.updatedAt = row.value instanceof Date ? row.value : settings.updatedAt
      }
    }
    if (row.updatedAt && (!latestUpdatedAt || row.updatedAt > latestUpdatedAt)) {
      latestUpdatedAt = row.updatedAt
    }
  }

  settings.updatedAt = latestUpdatedAt

  return settings
}

export async function updatePlatformSettings(formData: FormData) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const raw: Record<string, unknown> = {
    platformName: formData.get("platformName"),
    supportEmail: formData.get("supportEmail"),
    defaultCurrency: formData.get("defaultCurrency"),
    maintenanceMode: formData.get("maintenanceMode") === "on",
  }

  const platformName = raw.platformName as string
  const supportEmail = raw.supportEmail as string
  const defaultCurrency = raw.defaultCurrency as string
  if (!platformName || !supportEmail || !defaultCurrency) {
    throw new Error("Invalid form data")
  }

  const entries: Array<{ key: string; value: unknown }> = [
    { key: "platform_name", value: platformName.trim() },
    { key: "support_email", value: supportEmail.trim() },
    { key: "default_currency", value: defaultCurrency.trim() },
    { key: "platform_fee_percent", value: PLATFORM_FEE_PERCENT.toFixed(2) },
    { key: "maintenance_mode", value: raw.maintenanceMode },
  ]

  // Atomically replace settings: delete existing rows for these keys, then insert fresh ones.
  await db.transaction(async (tx) => {
    const keys = entries.map((e) => e.key)
    await tx
      .delete(platformSettings)
      .where(and(eq(platformSettings.env, ENV), inArray(platformSettings.key, keys)))

    for (const entry of entries) {
      await tx.insert(platformSettings).values({
        key: entry.key,
        value: entry.value,
        env: ENV,
        updatedBy: session.user.email ?? undefined,
      })
    }
  })

  log.info("Platform settings updated", { by: session.user.email })
  revalidatePath("/admin/settings")
  return { ok: true }
}
