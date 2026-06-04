import { notFound, redirect } from "next/navigation"
import { desc, eq } from "drizzle-orm"
import { Star, Link2 } from "lucide-react"

import { db } from "@/db"
import { events, reviews } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import CopyReviewLink from "./CopyReviewLink"

export const metadata = { title: "Reviews" }

export default async function OrganizerReviewsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const access = await requireEventAccess(id)
  if (!access.allowed) redirect(access.redirectTo)

  const [event] = await db
    .select({ id: events.id, title: events.title, slug: events.slug })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)

  if (!event) notFound()

  const rows = await db
    .select({
      id: reviews.id,
      reviewerName: reviews.reviewerName,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      status: reviews.status,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(eq(reviews.eventId, id))
    .orderBy(desc(reviews.createdAt))
    .limit(100)

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech").replace(/\/+$/, "")
  const reviewUrl = `${baseUrl}/reviews/new?event=${event.slug}`

  const statusCounts = rows.reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc },
    {} as Record<string, number>,
  )

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title="Reviews"
        subtitle="Share your review link with attendees and track responses."
        width="full"
      />

      <div className="max-w-4xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-8">

        {/* Share link card */}
        <div className="rounded-2xl border border-line bg-paper p-5 md:p-6">
          <div className="flex items-center gap-2 mb-1">
            <Link2 size={16} className="text-navy shrink-0" />
            <p className="text-[16px] font-semibold tracking-tight text-ink">Review link</p>
          </div>
          <p className="text-[13px] text-ink-3 mb-4">
            Share this link with attendees so they can leave a review for <strong className="text-ink">{event.title}</strong>.
            Reviews go through moderation before appearing publicly.
          </p>
          <CopyReviewLink url={reviewUrl} />
        </div>

        {/* Review count summary */}
        {rows.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {(["pending", "approved", "rejected"] as const).map((s) => (
              <div key={s} className="rounded-xl border border-line bg-paper p-4 text-center">
                <p className="text-[22px] font-bold tabular-nums text-ink">{statusCounts[s] ?? 0}</p>
                <p className="text-[12px] capitalize text-ink-3 mt-0.5">{s}</p>
              </div>
            ))}
          </div>
        )}

        {/* Reviews list */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden">
          <div className="px-5 md:px-6 py-4 border-b border-line">
            <h2 className="text-[16px] font-semibold tracking-tight text-ink">Submitted reviews</h2>
          </div>
          {rows.length === 0 ? (
            <EmptyState
              icon={Star}
              title="No reviews yet"
              body="Share the link above so attendees can leave their first review."
            />
          ) : (
            <div className="divide-y divide-line">
              {rows.map((review) => (
                <div key={review.id} className="px-5 md:px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 mb-1.5">
                        {[1, 2, 3, 4, 5].map((v) => (
                          <Star
                            key={v}
                            size={13}
                            className={v <= review.rating ? "fill-amber-400 text-amber-500" : "text-ink-3"}
                          />
                        ))}
                      </div>
                      {review.title && (
                        <p className="text-[14px] font-semibold text-ink">{review.title}</p>
                      )}
                      <p className="mt-1 text-[13px] leading-6 text-ink-2 line-clamp-3">{review.body}</p>
                      <p className="mt-2 text-[12px] text-ink-3">
                        {review.reviewerName}
                        {review.createdAt
                          ? ` · ${new Date(review.createdAt).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        review.status === "approved"
                          ? "bg-green-50 text-green-700 ring-1 ring-green-200"
                          : review.status === "rejected"
                          ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                          : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                      }`}
                    >
                      {review.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
