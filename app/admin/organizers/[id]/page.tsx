import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  BadgeX,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  MessageCircle,
  Phone,
  Snowflake,
  Unlock,
} from "lucide-react"
import { desc, eq } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, users } from "@/db/schema"
import { approveOrganizerAction, freezeOrganizerWithoutEventsAction, rejectOrganizerAction, unfreezeOrganizerAction } from "@/app/admin/actions/users"
import ConfirmReasonButton from "@/app/admin/_components/ConfirmReasonButton"
import PageHeader from "@/components/dashboard/PageHeader"
import { organizerProfileScore, organizerProfileScoreBreakdown } from "@/lib/organizer-profile-score"
import { isValidWhatsappContact } from "@/lib/phone"

export const metadata = { title: "Organizer review" }

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{label}</dt>
      <dd className="mt-1 break-words text-[13px] text-ink">{children || <span className="text-ink-3">Not provided</span>}</dd>
    </div>
  )
}

function formatDate(date: Date | null) {
  return date ? date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—"
}

export default async function OrganizerReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/organizers")
  }

  const { id } = await params
  const [organizer] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      phone: users.phone,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      approvedAt: users.approvedAt,
      organizerSlug: users.organizerSlug,
      organizerBio: users.organizerBio,
      organizerType: users.organizerType,
      organizerEntityName: users.organizerEntityName,
      organizerLocation: users.organizerLocation,
      organizerReferenceUrl: users.organizerReferenceUrl,
      organizerFrozenAt: users.organizerFrozenAt,
      organizerFreezeReason: users.organizerFreezeReason,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)

  if (!organizer || organizer.role !== "organizer") notFound()

  const recentEvents = await db
    .select({
      id: events.id,
      title: events.title,
      status: events.status,
      startsAt: events.startsAt,
      createdAt: events.createdAt,
      city: events.city,
      country: events.country,
    })
    .from(events)
    .where(eq(events.organizerId, organizer.id))
    .orderBy(desc(events.createdAt))
    .limit(10)

  const score = organizerProfileScore(organizer)
  const scoreBreakdown = organizerProfileScoreBreakdown(organizer)
  const typeLabel = organizer.organizerType === "individual"
    ? "Individual / sole trader"
    : organizer.organizerType === "business"
      ? "Registered business"
      : organizer.organizerType === "community"
        ? "Community group or other organisation"
        : null
  const whatsappValid = isValidWhatsappContact(organizer.phone ?? "")
  const profileUrl = organizer.organizerSlug ? `/o/${organizer.organizerSlug}` : null

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer review"
        title={organizer.name ?? "Unnamed organizer"}
        subtitle={organizer.email ?? "No email address"}
        width="full"
      />

      <div className="px-5 py-6 md:px-8 md:py-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/organizers" className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink">
            <ArrowLeft size={15} /> Back to organizers
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {organizer.email && <a href={`mailto:${organizer.email}`} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-[12px] font-semibold text-sky-700"><Mail size={13} /> Email</a>}
            {organizer.phone && <a href={`tel:${organizer.phone.replace(/[^+\d]/g, "")}`} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700"><Phone size={13} /> Call</a>}
            {organizer.phone && <a href={`https://wa.me/${organizer.phone.replace(/\D/g, "").replace(/^0/, "263")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-[12px] font-semibold text-green-700"><MessageCircle size={13} /> WhatsApp</a>}
            {profileUrl && <Link href={profileUrl} target="_blank" className="inline-flex items-center gap-1.5 rounded-lg bg-paper-2 px-3 py-2 text-[12px] font-semibold text-ink-2"><ArrowUpRight size={13} /> Public profile</Link>}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-line bg-paper p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-ink">Organizer profile</h2>
                  <p className="mt-1 text-[12px] text-ink-3">Submitted details and account contact information.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[12px] font-semibold text-blue-800">
                  <span className="text-[18px] leading-none">{score}</span><span>/100 complete</span>
                </div>
              </div>
              <dl className="grid gap-x-6 gap-y-5 pt-5 sm:grid-cols-2">
                <Detail label="Organizer name">{organizer.name}</Detail>
                <Detail label="Account email">{organizer.email}</Detail>
                <Detail label="Email verification">
                  <span className={`inline-flex items-center gap-1.5 ${organizer.emailVerified ? "text-emerald-700" : "text-amber-700"}`}>
                    {organizer.emailVerified ? <BadgeCheck size={14} /> : <Clock3 size={14} />}
                    {organizer.emailVerified ? `Verified ${formatDate(organizer.emailVerified)}` : "Verification link not completed"}
                  </span>
                </Detail>
                <Detail label="WhatsApp contact">
                  {organizer.phone ? <span>{organizer.phone} <span className="text-ink-3">· {whatsappValid ? "valid-looking format; ownership not verified" : "check number format"}</span></span> : null}
                </Detail>
                <Detail label="Organizer type">{typeLabel}</Detail>
                <Detail label="Business or group name">{organizer.organizerEntityName}</Detail>
                <Detail label="City and country">{organizer.organizerLocation}</Detail>
                <Detail label="Website or social reference">
                  {organizer.organizerReferenceUrl ? <a href={organizer.organizerReferenceUrl} target="_blank" rel="noreferrer" className="break-all text-blue hover:underline">{organizer.organizerReferenceUrl}</a> : null}
                </Detail>
                <Detail label="Public profile handle">{organizer.organizerSlug ? `ticketpulse.tech/o/${organizer.organizerSlug}` : null}</Detail>
                <Detail label="Account created">{formatDate(organizer.createdAt)}</Detail>
                <Detail label="Last profile update">{formatDate(organizer.updatedAt)}</Detail>
              </dl>
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Organizer bio</p>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">{organizer.organizerBio || "No bio provided."}</p>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-paper p-5 md:p-6">
              <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-ink">Events</h2>
                  <p className="mt-1 text-[12px] text-ink-3">Most recent first · {recentEvents.length === 10 ? "showing latest 10" : `${recentEvents.length} total`}</p>
                </div>
                <CalendarDays size={17} className="text-ink-3" />
              </div>
              {recentEvents.length === 0 ? (
                <p className="py-6 text-[13px] text-ink-3">This organizer has not created an event yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {recentEvents.map((event) => (
                    <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink">{event.title}</p>
                        <p className="mt-1 text-[11px] text-ink-3">{event.city}{event.country ? `, ${event.country}` : ""} · Created {formatDate(event.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <span className="rounded-full bg-paper-2 px-2.5 py-1 text-[11px] font-medium capitalize text-ink-2">{event.status?.replaceAll("_", " ") ?? "unknown"}</span>
                        <p className="mt-1 text-[11px] text-ink-3">Starts {formatDate(event.startsAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-line bg-paper p-5">
              <h2 className="text-[15px] font-semibold text-ink">Profile completeness</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-3">This score helps spot missing profile details. It is not identity verification or an automatic approval decision.</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-paper-3">
                <div className="h-full rounded-full bg-blue" style={{ width: `${score}%` }} />
              </div>
              <div className="mt-4 space-y-3">
                {scoreBreakdown.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="text-ink-2">{item.label}</span>
                    <span className={item.earned === item.possible ? "font-semibold text-emerald-700" : "text-ink-3"}>{item.earned}/{item.possible}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-3">RBZ 2025 AML/CFT/CPF guidance and POTRAZ data-protection requirements guide the review. WhatsApp format and email-link completion do not establish a person&apos;s legal identity.</p>
            </section>

            <section className="rounded-2xl border border-line bg-paper p-5">
              <h2 className="text-[15px] font-semibold text-ink">Account status</h2>
              <div className="mt-4 space-y-3 text-[13px]">
                <p className="flex items-center gap-2">
                  {organizer.organizerFrozenAt ? <Snowflake size={15} className="text-sky-700" /> : organizer.approvedAt ? <BadgeCheck size={15} className="text-emerald-700" /> : <BadgeX size={15} className="text-amber-700" />}
                  {organizer.organizerFrozenAt ? "Frozen" : organizer.approvedAt ? "Approved" : "Pending approval"}
                </p>
                <p className="text-[11px] text-ink-3">{organizer.approvedAt ? `Approved ${formatDate(organizer.approvedAt)}` : "Not yet approved"}</p>
                {organizer.organizerFrozenAt && <p className="text-[12px] text-ink-2">{organizer.organizerFreezeReason ?? "No freeze reason recorded."}</p>}
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                {!organizer.approvedAt && !organizer.organizerFrozenAt && (
                  <form action={approveOrganizerAction.bind(null, organizer.id)}>
                    <button type="submit" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-[12px] font-semibold text-paper hover:bg-ink/85"><CheckCircle2 size={14} /> Approve organizer</button>
                  </form>
                )}
                {organizer.approvedAt && !organizer.organizerFrozenAt && (
                  <ConfirmReasonButton
                    action={rejectOrganizerAction.bind(null, organizer.id)}
                    label="Revoke approval"
                    confirmLabel="Confirm revoke"
                    prompt="Reason for revoking approval"
                    buttonClassName="inline-flex min-h-10 items-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700 hover:bg-rose-100"
                  />
                )}
                {organizer.organizerFrozenAt ? (
                  <form action={unfreezeOrganizerAction.bind(null, organizer.id)}>
                    <button type="submit" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-[12px] font-semibold text-sky-700 hover:bg-sky-100"><Unlock size={14} /> Unfreeze account</button>
                  </form>
                ) : recentEvents.length === 0 ? (
                  <ConfirmReasonButton
                    action={freezeOrganizerWithoutEventsAction.bind(null, organizer.id)}
                    label="Freeze account"
                    confirmLabel="Confirm freeze"
                    prompt="Reason for freezing account"
                    icon={<Snowflake size={14} />}
                    buttonClassName="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-100"
                  />
                ) : null}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
