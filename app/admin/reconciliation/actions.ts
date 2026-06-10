"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { eq } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { velocitySettlements } from "@/db/schema"
import { adminEmail, sendEmail } from "@/lib/email"
import { velocityReconciliationEmail } from "@/lib/email-templates"
import { generateReconciliationPdfBuffer } from "@/lib/pdf/reconciliation"
import { getVelocityReconciliationReport, velocityReconciliationToCsv } from "@/lib/velocity-reconciliation"

const SettlementSchema = z.object({
  settlementDate: z.string().min(1, "Settlement date is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  currency: z.string().trim().min(1).max(8).default("USD"),
  reference: z.string().trim().min(3, "Reference is required").max(120),
  eventId: z.string().uuid().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
})

function parseOptionalDate(value: string | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function recordVelocitySettlementAction(formData: FormData) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const parsed = SettlementSchema.safeParse({
    settlementDate: formData.get("settlementDate"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || "USD",
    reference: formData.get("reference"),
    eventId: formData.get("eventId") || undefined,
    periodStart: formData.get("periodStart") || undefined,
    periodEnd: formData.get("periodEnd") || undefined,
    notes: formData.get("notes") || undefined,
  })

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid settlement")
  }

  const settlementDate = new Date(parsed.data.settlementDate)
  if (Number.isNaN(settlementDate.getTime())) {
    throw new Error("Invalid settlement date")
  }

  const [existing] = await db
    .select({ id: velocitySettlements.id })
    .from(velocitySettlements)
    .where(eq(velocitySettlements.reference, parsed.data.reference))
    .limit(1)

  if (existing) {
    throw new Error("A Velocity settlement with this reference already exists")
  }

  await db.insert(velocitySettlements).values({
    eventId: parsed.data.eventId ?? null,
    settlementDate,
    periodStart: parseOptionalDate(parsed.data.periodStart),
    periodEnd: parseOptionalDate(parsed.data.periodEnd),
    amount: parsed.data.amount.toFixed(2),
    currency: parsed.data.currency.toUpperCase(),
    reference: parsed.data.reference,
    notes: parsed.data.notes || null,
    recordedBy: session.user.email ?? session.user.id,
  })

  revalidatePath("/admin/reconciliation")
}

const SendReconSchema = z.object({
  recipient: z.string().trim().email("A valid recipient email is required"),
  note: z.string().trim().max(500).optional(),
})

export async function sendVelocityReconciliationAction(formData: FormData) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const parsed = SendReconSchema.safeParse({
    recipient: formData.get("recipient") || process.env.VELOCITY_RECON_EMAIL,
    note: formData.get("note") || undefined,
  })

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid recipient")
  }

  const report = await getVelocityReconciliationReport()
  const stamp = report.generatedAt.toISOString().slice(0, 10)

  const [pdf, csv] = await Promise.all([
    generateReconciliationPdfBuffer(report),
    Promise.resolve(velocityReconciliationToCsv(report)),
  ])

  const { html, text } = velocityReconciliationEmail({
    generatedAt: report.generatedAt,
    totals: report.totals,
    note: parsed.data.note ?? null,
  })

  const result = await sendEmail({
    to: parsed.data.recipient,
    cc: adminEmail,
    replyTo: session.user.email ?? adminEmail,
    subject: `TicketPulse — Velocity reconciliation report ${stamp}`,
    html,
    text,
    attachments: [
      { filename: `velocity-reconciliation-${stamp}.pdf`, content: pdf, contentType: "application/pdf" },
      { filename: `velocity-reconciliation-${stamp}.csv`, content: Buffer.from(csv, "utf-8"), contentType: "text/csv" },
    ],
  })

  if ("skipped" in result) {
    throw new Error(`Email not sent: ${result.reason}`)
  }

  revalidatePath("/admin/reconciliation")
  redirect(`/admin/reconciliation?sent=${encodeURIComponent(parsed.data.recipient)}`)
}

export async function deleteVelocitySettlementAction(settlementId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  await db.delete(velocitySettlements).where(eq(velocitySettlements.id, settlementId))
  revalidatePath("/admin/reconciliation")
}
