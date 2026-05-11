"use server"

import { auth } from "@/auth"
import { db } from "@/db"
import {
  platformSettings,
  settingsAlertOutbox,
  settingsAuditLogs,
  settingsChangeProposals,
} from "@/db/schema"
import { and, desc, eq, inArray, lte, or, sql } from "drizzle-orm"
import crypto from "crypto"
import { revalidatePath } from "next/cache"
import { z } from "zod"

export type FeatureFlags = {
  checkoutV2: boolean
  analyticsV2: boolean
  organizerBetaTools: boolean
}

export type PaymentMethod = "EcoCash" | "Card" | "Bank" | "USD cash"

export type PaymentConfig = {
  ecoCashEnabled: boolean
  cardEnabled: boolean
  bankEnabled: boolean
  usdCashEnabled: boolean
  failoverOrder: PaymentMethod[]
}

export type NotificationRules = {
  orderPaid: boolean
  orderRefunded: boolean
  payoutProcessed: boolean
  disputeOpened: boolean
  digestFrequency: "hourly" | "daily" | "weekly"
  adminAlertEmail: string
}

export type SecurityConfig = {
  enforceAdmin2FA: boolean
  enforceOrganizer2FA: boolean
  sessionMaxAgeHours: number
  maxConcurrentSessions: number
  passwordMinLength: number
}

export type SettingsBundle = {
  featureFlags: FeatureFlags
  paymentConfig: PaymentConfig
  notificationRules: NotificationRules
  securityConfig: SecurityConfig
}

export type SettingsKey = keyof SettingsBundle

export type SettingsAuditItem = {
  id: string
  key: string
  action: string
  sourceAction: string
  reason: string | null
  actorEmail: string | null
  actorRole: string | null
  createdAt: Date
}

export type PlatformEnv = "dev" | "stage" | "prod"

export type AuditFilter = {
  env?: PlatformEnv
  key?: SettingsKey | "all"
  action?: "all" | "create" | "update" | "rollback"
  sourceAction?: "all" | "save" | "rollback"
  page?: number
  pageSize?: number
}

export type ProposalItem = {
  id: string
  env: PlatformEnv
  key: SettingsKey
  action: "save" | "rollback"
  status: string
  reason: string
  requestedByEmail: string | null
  approvedByEmail: string | null
  rejectedByEmail: string | null
  rejectReason: string | null
  effectiveAt: Date | null
  applyAfter: Date | null
  createdAt: Date
}

const DEFAULTS: SettingsBundle = {
  featureFlags: {
    checkoutV2: false,
    analyticsV2: false,
    organizerBetaTools: false,
  },
  paymentConfig: {
    ecoCashEnabled: true,
    cardEnabled: true,
    bankEnabled: true,
    usdCashEnabled: false,
    failoverOrder: ["EcoCash", "Card", "Bank", "USD cash"],
  },
  notificationRules: {
    orderPaid: true,
    orderRefunded: true,
    payoutProcessed: true,
    disputeOpened: true,
    digestFrequency: "daily",
    adminAlertEmail: "support@ticketpulse.co.zw",
  },
  securityConfig: {
    enforceAdmin2FA: true,
    enforceOrganizer2FA: false,
    sessionMaxAgeHours: 24 * 7,
    maxConcurrentSessions: 5,
    passwordMinLength: 8,
  },
}

const SUPER_ADMIN_EMAIL = "nick@ticketpulse.tech"
const SETTINGS_KEYS = [
  "featureFlags",
  "paymentConfig",
  "notificationRules",
  "securityConfig",
] as const

const PAYMENT_METHODS = ["EcoCash", "Card", "Bank", "USD cash"] as const
const DIGEST_VALUES = ["hourly", "daily", "weekly"] as const

const featureFlagsSchema = z.object({
  checkoutV2: z.boolean(),
  analyticsV2: z.boolean(),
  organizerBetaTools: z.boolean(),
})

const paymentConfigSchema = z.object({
  ecoCashEnabled: z.boolean(),
  cardEnabled: z.boolean(),
  bankEnabled: z.boolean(),
  usdCashEnabled: z.boolean(),
  failoverOrder: z.array(z.enum(PAYMENT_METHODS)).min(1),
}).superRefine((value, ctx) => {
  const enabled = new Set<PaymentMethod>()
  if (value.ecoCashEnabled) enabled.add("EcoCash")
  if (value.cardEnabled) enabled.add("Card")
  if (value.bankEnabled) enabled.add("Bank")
  if (value.usdCashEnabled) enabled.add("USD cash")

  if (enabled.size === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one payment method must remain enabled.",
      path: ["failoverOrder"],
    })
  }

  const orderSet = new Set(value.failoverOrder)
  for (const method of enabled) {
    if (!orderSet.has(method)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Failover order must include enabled method: ${method}.`,
        path: ["failoverOrder"],
      })
    }
  }
})

const notificationRulesSchema = z.object({
  orderPaid: z.boolean(),
  orderRefunded: z.boolean(),
  payoutProcessed: z.boolean(),
  disputeOpened: z.boolean(),
  digestFrequency: z.enum(DIGEST_VALUES),
  adminAlertEmail: z.string().email(),
})

const securityConfigSchema = z.object({
  enforceAdmin2FA: z.boolean(),
  enforceOrganizer2FA: z.boolean(),
  sessionMaxAgeHours: z.number().int().min(1).max(24 * 60),
  maxConcurrentSessions: z.number().int().min(1).max(100),
  passwordMinLength: z.number().int().min(6).max(64),
})

const settingsBundleSchema = z.object({
  featureFlags: featureFlagsSchema,
  paymentConfig: paymentConfigSchema,
  notificationRules: notificationRulesSchema,
  securityConfig: securityConfigSchema,
})

function parseBool(v: FormDataEntryValue | null): boolean {
  return v === "on" || v === "true" || v === "1"
}

function parseNum(v: FormDataEntryValue | null, fallback: number): number {
  const n = Number(v ?? fallback)
  return Number.isFinite(n) ? n : fallback
}

function parseFailoverOrder(v: FormDataEntryValue | null): PaymentMethod[] {
  const raw = String(v ?? "EcoCash,Card,Bank,USD cash")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)

  const seen = new Set<PaymentMethod>()
  const parsed: PaymentMethod[] = []

  for (const item of raw) {
    if ((PAYMENT_METHODS as readonly string[]).includes(item)) {
      const method = item as PaymentMethod
      if (!seen.has(method)) {
        seen.add(method)
        parsed.push(method)
      }
    }
  }

  if (parsed.length === 0) return [...DEFAULTS.paymentConfig.failoverOrder]
  return parsed
}

function sanitizeReason(v: FormDataEntryValue | null): string | null {
  const text = String(v ?? "").trim()
  return text.length ? text : null
}

function parseExpectedVersion(v: FormDataEntryValue | null, fallback = 0): number {
  const n = Number(v ?? fallback)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`).join(",")}}`
}

async function getLastAuditHash() {
  const rows = await db
    .select({ hash: settingsAuditLogs.hash })
    .from(settingsAuditLogs)
    .orderBy(desc(settingsAuditLogs.createdAt))
    .limit(1)

  return rows[0]?.hash ?? null
}

async function appendImmutableAuditLog(params: {
  env?: "dev" | "stage" | "prod"
  key: SettingsKey
  oldValue: unknown
  newValue: unknown
  actorUserId: string | null
  actorEmail: string | null
  actorRole: string | null
  reason: string | null
  sourceAction: "save" | "rollback"
  action: "create" | "update" | "rollback"
  requestId?: string | null
}) {
  const env = params.env ?? "prod"
  const prevHash = await getLastAuditHash()
  const payload = canonicalStringify({
    env,
    key: params.key,
    oldValue: params.oldValue,
    newValue: params.newValue,
    actorUserId: params.actorUserId,
    actorEmail: params.actorEmail,
    actorRole: params.actorRole,
    reason: params.reason,
    sourceAction: params.sourceAction,
    action: params.action,
    requestId: params.requestId ?? null,
    prevHash,
    ts: new Date().toISOString(),
  })

  const hash = crypto.createHash("sha256").update(payload).digest("hex")
  const secret = process.env.SETTINGS_AUDIT_SIGNING_KEY ?? "dev-insecure-signing-key"
  const signature = crypto.createHmac("sha256", secret).update(hash).digest("hex")

  await db.insert(settingsAuditLogs).values({
    env,
    key: params.key,
    oldValue: params.oldValue,
    newValue: params.newValue,
    actorUserId: params.actorUserId,
    actorEmail: params.actorEmail,
    actorRole: params.actorRole,
    reason: params.reason,
    sourceAction: params.sourceAction,
    action: params.action,
    requestId: params.requestId ?? null,
    prevHash,
    hash,
    signature,
    immutable: true,
    createdAt: new Date(),
  })
}

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }
  return session
}

function isSuperAdminEmail(email: string | null | undefined): boolean {
  return String(email ?? "").trim().toLowerCase() === SUPER_ADMIN_EMAIL
}

async function requireSuperAdmin() {
  const session = await requireAdmin()
  if (!isSuperAdminEmail(session.user.email)) {
    throw new Error("Super-admin permission required.")
  }
  return session
}

function parseEnv(v: FormDataEntryValue | null | undefined): PlatformEnv {
  const raw = String(v ?? "prod").toLowerCase()
  if (raw === "dev" || raw === "stage" || raw === "prod") return raw
  return "prod"
}

function parseOptionalDate(v: FormDataEntryValue | null): Date | null {
  const raw = String(v ?? "").trim()
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

async function enqueueOutbox(env: PlatformEnv, eventType: string, payload: unknown) {
  await db.insert(settingsAlertOutbox).values({
    env,
    eventType,
    payload,
    status: "pending",
    attempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
}

async function getExistingSettingsRows(env: PlatformEnv) {
  const rows = await db
    .select({
      key: platformSettings.key,
      value: platformSettings.value,
      version: platformSettings.version,
    })
    .from(platformSettings)
    .where(and(eq(platformSettings.env, env), inArray(platformSettings.key, [...SETTINGS_KEYS])))

  const map = new Map(rows.map((r) => [r.key, r]))
  return map
}

export async function getSettingsBundle(env: PlatformEnv = "prod"): Promise<SettingsBundle> {
  await requireAdmin()

  const map = await getExistingSettingsRows(env)

  return {
    featureFlags: (map.get("featureFlags")?.value as FeatureFlags) ?? DEFAULTS.featureFlags,
    paymentConfig: (map.get("paymentConfig")?.value as PaymentConfig) ?? DEFAULTS.paymentConfig,
    notificationRules: (map.get("notificationRules")?.value as NotificationRules) ?? DEFAULTS.notificationRules,
    securityConfig: (map.get("securityConfig")?.value as SecurityConfig) ?? DEFAULTS.securityConfig,
  }
}

export async function getSettingsVersions(env: PlatformEnv = "prod"): Promise<Record<SettingsKey, number>> {
  await requireAdmin()

  const map = await getExistingSettingsRows(env)

  return {
    featureFlags: map.get("featureFlags")?.version ?? 0,
    paymentConfig: map.get("paymentConfig")?.version ?? 0,
    notificationRules: map.get("notificationRules")?.version ?? 0,
    securityConfig: map.get("securityConfig")?.version ?? 0,
  }
}

export async function getSettingsAudit(filter: AuditFilter = {}) {
  await requireAdmin()
  const env = filter.env ?? "prod"

  const page = Math.max(1, filter.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20))

  const whereClauses = [eq(settingsAuditLogs.env, env)]
  if (filter.key && filter.key !== "all") {
    whereClauses.push(eq(settingsAuditLogs.key, filter.key))
  }
  if (filter.action && filter.action !== "all") {
    whereClauses.push(eq(settingsAuditLogs.action, filter.action))
  }
  if (filter.sourceAction && filter.sourceAction !== "all") {
    whereClauses.push(eq(settingsAuditLogs.sourceAction, filter.sourceAction))
  }

  const whereExpr = whereClauses.length ? and(...whereClauses) : undefined

  const baseQuery = db
    .select({
      id: settingsAuditLogs.id,
      key: settingsAuditLogs.key,
      action: settingsAuditLogs.action,
      sourceAction: settingsAuditLogs.sourceAction,
      reason: settingsAuditLogs.reason,
      actorEmail: settingsAuditLogs.actorEmail,
      actorRole: settingsAuditLogs.actorRole,
      createdAt: settingsAuditLogs.createdAt,
    })
    .from(settingsAuditLogs)

  const countQuery = db
    .select({ count: sql<number>`count(*)::int` })
    .from(settingsAuditLogs)

  const rows = whereExpr
    ? await baseQuery.where(whereExpr).orderBy(desc(settingsAuditLogs.createdAt)).limit(pageSize).offset((page - 1) * pageSize)
    : await baseQuery.orderBy(desc(settingsAuditLogs.createdAt)).limit(pageSize).offset((page - 1) * pageSize)

  const totalRows = whereExpr
    ? await countQuery.where(whereExpr)
    : await countQuery

  const total = totalRows[0]?.count ?? 0

  return {
    items: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt ?? new Date(),
    })) as SettingsAuditItem[],
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

function parseAndValidateBundle(formData: FormData): SettingsBundle {
  const bundle: SettingsBundle = {
    featureFlags: {
      checkoutV2: parseBool(formData.get("ff_checkoutV2")),
      analyticsV2: parseBool(formData.get("ff_analyticsV2")),
      organizerBetaTools: parseBool(formData.get("ff_organizerBetaTools")),
    },
    paymentConfig: {
      ecoCashEnabled: parseBool(formData.get("pay_ecoCashEnabled")),
      cardEnabled: parseBool(formData.get("pay_cardEnabled")),
      bankEnabled: parseBool(formData.get("pay_bankEnabled")),
      usdCashEnabled: parseBool(formData.get("pay_usdCashEnabled")),
      failoverOrder: parseFailoverOrder(formData.get("pay_failoverOrder")),
    },
    notificationRules: {
      orderPaid: parseBool(formData.get("nr_orderPaid")),
      orderRefunded: parseBool(formData.get("nr_orderRefunded")),
      payoutProcessed: parseBool(formData.get("nr_payoutProcessed")),
      disputeOpened: parseBool(formData.get("nr_disputeOpened")),
      digestFrequency: (String(formData.get("nr_digestFrequency") ?? "daily") as NotificationRules["digestFrequency"]),
      adminAlertEmail: String(formData.get("nr_adminAlertEmail") ?? DEFAULTS.notificationRules.adminAlertEmail),
    },
    securityConfig: {
      enforceAdmin2FA: parseBool(formData.get("sec_enforceAdmin2FA")),
      enforceOrganizer2FA: parseBool(formData.get("sec_enforceOrganizer2FA")),
      sessionMaxAgeHours: parseNum(formData.get("sec_sessionMaxAgeHours"), DEFAULTS.securityConfig.sessionMaxAgeHours),
      maxConcurrentSessions: parseNum(formData.get("sec_maxConcurrentSessions"), DEFAULTS.securityConfig.maxConcurrentSessions),
      passwordMinLength: parseNum(formData.get("sec_passwordMinLength"), DEFAULTS.securityConfig.passwordMinLength),
    },
  }

  return settingsBundleSchema.parse(bundle)
}

function requiresReasonForSensitiveChange(
  key: SettingsKey,
  oldValue: unknown,
  newValue: unknown,
): boolean {
  if (key === "paymentConfig" || key === "securityConfig") {
    return JSON.stringify(oldValue) !== JSON.stringify(newValue)
  }
  return false
}

export async function saveSettings(formData: FormData) {
  const session = await requireAdmin()
  const env = parseEnv(formData.get("env"))
  const requiresApproval = parseBool(formData.get("requires_approval"))
  const applyAfter = parseOptionalDate(formData.get("apply_after"))

  const reason = sanitizeReason(formData.get("change_reason"))
  const next = parseAndValidateBundle(formData)
  const existingRows = await getExistingSettingsRows(env)

  for (const key of SETTINGS_KEYS) {
    const oldRow = existingRows.get(key)
    const oldValue = oldRow?.value ?? null
    const oldVersion = oldRow?.version ?? 0
    const expectedVersion = parseExpectedVersion(formData.get(`version_${key}`), oldVersion)

    if (expectedVersion !== oldVersion) {
      throw new Error(`Conflict detected for ${key}. Please refresh and try again.`)
    }

    const newValue = next[key]
    const action = oldValue === null ? "create" : "update"

    if (requiresReasonForSensitiveChange(key, oldValue, newValue) && !reason) {
      throw new Error(`A change reason is required when updating ${key}.`)
    }

    if (requiresApproval && !isSuperAdminEmail(session.user.email)) {
      await db.insert(settingsChangeProposals).values({
        env,
        key,
        action: "save",
        status: "pending_approval",
        proposedOldValue: oldValue,
        proposedNewValue: newValue,
        reason: reason ?? "Change requested",
        requestedByUserId: session.user.id ?? null,
        requestedByEmail: session.user.email ?? null,
        requestedByRole: session.user.role ?? null,
        applyAfter,
        expectedVersion,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await enqueueOutbox(env, "settings.proposed", { key, requestedBy: session.user.email ?? null })
      continue
    }

    const inserted = await db
      .insert(platformSettings)
      .values({
        env,
        key,
        value: newValue,
        version: oldVersion + 1,
        updatedBy: session.user.id ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [platformSettings.env, platformSettings.key],
        set: {
          value: newValue,
          version: oldVersion + 1,
          updatedBy: session.user.id ?? null,
          updatedAt: new Date(),
        },
        setWhere: and(eq(platformSettings.version, expectedVersion), eq(platformSettings.env, env)),
      })
      .returning({ key: platformSettings.key })

    if (inserted.length === 0) {
      throw new Error(`Conflict detected while saving ${key}. Please refresh and retry.`)
    }

    await appendImmutableAuditLog({
      env,
      key,
      oldValue,
      newValue,
      actorUserId: session.user.id ?? null,
      actorEmail: session.user.email ?? null,
      actorRole: session.user.role ?? null,
      reason,
      sourceAction: "save",
      action,
    })

    await enqueueOutbox(env, "settings.changed", { key, action })
  }

  revalidatePath("/admin/settings")
}

export async function rollbackSetting(logId: string, rollbackReason: string) {
  const session = await requireSuperAdmin()
  const reason = rollbackReason.trim()
  if (!reason) {
    throw new Error("Rollback reason is required.")
  }

  const rows = await db
    .select({
      id: settingsAuditLogs.id,
      env: settingsAuditLogs.env,
      key: settingsAuditLogs.key,
      oldValue: settingsAuditLogs.oldValue,
      newValue: settingsAuditLogs.newValue,
    })
    .from(settingsAuditLogs)
    .where(eq(settingsAuditLogs.id, logId))
    .limit(1)

  const log = rows[0]
  if (!log) throw new Error("Audit entry not found.")

  const key = log.key as SettingsKey
  if (!(SETTINGS_KEYS as readonly string[]).includes(key)) {
    throw new Error("Invalid settings key for rollback.")
  }

  const targetValue = log.oldValue ?? DEFAULTS[key]
  const env = (log.env ?? "prod") as PlatformEnv
  const current = await db
    .select({
      value: platformSettings.value,
      version: platformSettings.version,
    })
    .from(platformSettings)
    .where(and(eq(platformSettings.env, env), eq(platformSettings.key, key)))
    .limit(1)

  const currentValue = current[0]?.value ?? null
  const currentVersion = current[0]?.version ?? 0

  const updated = await db
    .insert(platformSettings)
    .values({
      env,
      key,
      value: targetValue,
      version: currentVersion + 1,
      updatedBy: session.user.id ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [platformSettings.env, platformSettings.key],
      set: {
        value: targetValue,
        version: currentVersion + 1,
        updatedBy: session.user.id ?? null,
        updatedAt: new Date(),
      },
      setWhere: and(eq(platformSettings.version, currentVersion), eq(platformSettings.env, env)),
    })
    .returning({ key: platformSettings.key })

  if (updated.length === 0) {
    throw new Error("Conflict detected during rollback. Please retry.")
  }

  await appendImmutableAuditLog({
    env,
    key,
    oldValue: currentValue,
    newValue: targetValue,
    actorUserId: session.user.id ?? null,
    actorEmail: session.user.email ?? null,
    actorRole: session.user.role ?? null,
    reason,
    sourceAction: "rollback",
    action: "rollback",
  })

  await enqueueOutbox(env, "settings.rollback", { key, logId })
  revalidatePath("/admin/settings")
}

export async function getPendingProposals(env: PlatformEnv = "prod"): Promise<ProposalItem[]> {
  await requireAdmin()
  const rows = await db
    .select({
      id: settingsChangeProposals.id,
      env: settingsChangeProposals.env,
      key: settingsChangeProposals.key,
      action: settingsChangeProposals.action,
      status: settingsChangeProposals.status,
      reason: settingsChangeProposals.reason,
      requestedByEmail: settingsChangeProposals.requestedByEmail,
      approvedByEmail: settingsChangeProposals.approvedByEmail,
      rejectedByEmail: settingsChangeProposals.rejectedByEmail,
      rejectReason: settingsChangeProposals.rejectReason,
      effectiveAt: settingsChangeProposals.effectiveAt,
      applyAfter: settingsChangeProposals.applyAfter,
      createdAt: settingsChangeProposals.createdAt,
    })
    .from(settingsChangeProposals)
    .where(and(eq(settingsChangeProposals.env, env), eq(settingsChangeProposals.status, "pending_approval")))
    .orderBy(desc(settingsChangeProposals.createdAt))
    .limit(100)

  return rows.map((r) => ({
    ...r,
    key: r.key as SettingsKey,
    action: r.action as "save" | "rollback",
    env: r.env as PlatformEnv,
    createdAt: r.createdAt ?? new Date(),
    effectiveAt: r.effectiveAt ?? null,
    applyAfter: r.applyAfter ?? null,
  }))
}

export async function approveProposal(proposalId: string) {
  const session = await requireSuperAdmin()
  const now = new Date()

  const rows = await db
    .select()
    .from(settingsChangeProposals)
    .where(eq(settingsChangeProposals.id, proposalId))
    .limit(1)

  const row = rows[0]
  if (!row) throw new Error("Proposal not found.")
  if (row.status !== "pending_approval") throw new Error("Proposal is not pending approval.")

  await db
    .update(settingsChangeProposals)
    .set({
      status: "approved",
      approvedByUserId: session.user.id ?? null,
      approvedByEmail: session.user.email ?? null,
      approvedByRole: session.user.role ?? null,
      approvedAt: now,
      updatedAt: now,
    })
    .where(eq(settingsChangeProposals.id, proposalId))

  await enqueueOutbox((row.env as PlatformEnv) ?? "prod", "settings.proposal.approved", { proposalId })
  revalidatePath("/admin/settings")
}

export async function rejectProposal(proposalId: string, rejectReason: string) {
  const session = await requireSuperAdmin()
  const reason = rejectReason.trim()
  if (!reason) throw new Error("Reject reason is required.")

  const rows = await db
    .select()
    .from(settingsChangeProposals)
    .where(eq(settingsChangeProposals.id, proposalId))
    .limit(1)

  const row = rows[0]
  if (!row) throw new Error("Proposal not found.")
  if (row.status !== "pending_approval") throw new Error("Proposal is not pending approval.")

  await db
    .update(settingsChangeProposals)
    .set({
      status: "rejected",
      rejectedByUserId: session.user.id ?? null,
      rejectedByEmail: session.user.email ?? null,
      rejectedByRole: session.user.role ?? null,
      rejectedAt: new Date(),
      rejectReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(settingsChangeProposals.id, proposalId))

  await enqueueOutbox((row.env as PlatformEnv) ?? "prod", "settings.proposal.rejected", { proposalId, reason })
  revalidatePath("/admin/settings")
}

export async function applyApprovedProposals(env: PlatformEnv = "prod") {
  const session = await requireSuperAdmin()
  const now = new Date()

  const rows = await db
    .select()
    .from(settingsChangeProposals)
    .where(
      and(
        eq(settingsChangeProposals.env, env),
        eq(settingsChangeProposals.status, "approved"),
        or(sql`${settingsChangeProposals.applyAfter} is null`, lte(settingsChangeProposals.applyAfter, now)),
      ),
    )
    .orderBy(desc(settingsChangeProposals.createdAt))
    .limit(200)

  for (const row of rows) {
    const key = row.key as SettingsKey
    const current = await db
      .select({
        value: platformSettings.value,
        version: platformSettings.version,
      })
      .from(platformSettings)
      .where(and(eq(platformSettings.env, env), eq(platformSettings.key, key)))
      .limit(1)

    const currentVersion = current[0]?.version ?? 0
    const expectedVersion = row.expectedVersion ?? currentVersion
    if (currentVersion !== expectedVersion) continue

    const nextValue = row.proposedNewValue
    if (nextValue === null) continue

    const upserted = await db
      .insert(platformSettings)
      .values({
        env,
        key,
        value: nextValue,
        version: currentVersion + 1,
        updatedBy: session.user.id ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [platformSettings.env, platformSettings.key],
        set: {
          value: nextValue,
          version: currentVersion + 1,
          updatedBy: session.user.id ?? null,
          updatedAt: now,
        },
        setWhere: and(eq(platformSettings.version, currentVersion), eq(platformSettings.env, env)),
      })
      .returning({ key: platformSettings.key })

    if (!upserted.length) continue

    await appendImmutableAuditLog({
      env,
      key,
      oldValue: current[0]?.value ?? null,
      newValue: nextValue,
      actorUserId: session.user.id ?? null,
      actorEmail: session.user.email ?? null,
      actorRole: session.user.role ?? null,
      reason: row.reason,
      sourceAction: "save",
      action: current[0]?.value == null ? "create" : "update",
      requestId: row.id,
    })

    await db
      .update(settingsChangeProposals)
      .set({
        status: "applied",
        appliedAt: now,
        updatedAt: now,
      })
      .where(eq(settingsChangeProposals.id, row.id))

    await enqueueOutbox(env, "settings.proposal.applied", { proposalId: row.id, key })
  }

  revalidatePath("/admin/settings")
}

export async function exportImmutableAudit(env: PlatformEnv = "prod"): Promise<string> {
  await requireSuperAdmin()

  const rows = await db
    .select({
      id: settingsAuditLogs.id,
      env: settingsAuditLogs.env,
      key: settingsAuditLogs.key,
      action: settingsAuditLogs.action,
      sourceAction: settingsAuditLogs.sourceAction,
      actorEmail: settingsAuditLogs.actorEmail,
      reason: settingsAuditLogs.reason,
      hash: settingsAuditLogs.hash,
      prevHash: settingsAuditLogs.prevHash,
      signature: settingsAuditLogs.signature,
      createdAt: settingsAuditLogs.createdAt,
    })
    .from(settingsAuditLogs)
    .where(eq(settingsAuditLogs.env, env))
    .orderBy(desc(settingsAuditLogs.createdAt))
    .limit(1000)

  return JSON.stringify(rows, null, 2)
}
