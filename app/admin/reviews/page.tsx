import { redirect } from "next/navigation"
import { desc, eq } from "drizzle-orm"
import { CheckCircle2, Star, XCircle } from "lucide-react"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, reviews } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { approveReviewAction, rejectReviewAction, toggleFeaturedReviewAction } from "./actions"

export const metadata = { title: "Review moderation" }

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/reviews")
  }

  const sp = await searchParams
  const status = sp.status === "approved" || sp.status === "rejected" ? sp.status : "pending"

  const rows = await db
    .select({
      id: reviews.id,
      reviewerName: reviews.reviewerName,
      reviewerEmail: reviews.reviewerEmail,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      status: reviews.status,
      featured: reviews.featured,
      publicConsent: reviews.publicConsent,
      createdAt: reviews.createdAt,
      eventTitle: events.title,
      eventSlug: events.slug,
    })
    .from(reviews)
    .leftJoin(events, eq(events.id, reviews.eventId))
    .where(eq(reviews.status, status))
    .orderBy(desc(reviews.createdAt))
    .limit(80)

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Admin"
        title="Review moderation"
        subtitle="Approve attendee and customer reviews before they appear publicly."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-5">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {(["pending", "approved", "rejected"] as const).map((tab) => (
            <a
              key={tab}
              href={`/admin/reviews?status=${tab}`}
              className={`rounded-lg px-3.5 py-2 text-[13px] capitalize transition-colors ${
                status === tab ? "bg-paper-2 text-ink font-semibold ring-1 ring-line" : "text-ink-2 hover:text-ink hover:bg-paper-2 font-medium"
              }`}
            >
              {tab}
            </a>
          ))}
        </div>

        <div className="rounded-2xl border border-line bg-paper overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState icon={Star} title="No reviews here" body="Reviews will appear here when guests submit them." />
          ) : (
            <div className="divide-y divide-line">
              {rows.map((review) => (
                <article key={review.id} className="p-5 md:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <Star key={value} size={14} className={value <= review.rating ? "fill-amber-400 text-amber-500" : "text-ink-3"} />
                        ))}
                      </div>
                      <h2 className="text-[16px] font-bold tracking-tight text-ink">{review.title || "Untitled review"}</h2>
                      <p className="mt-1 text-[13px] text-ink-3">
                        {review.reviewerName} · {review.reviewerEmail}
                        {review.eventTitle ? ` · ${review.eventTitle}` : ""}
                      </p>
                      <p className="mt-3 max-w-3xl text-[14px] leading-6 text-ink-2">{review.body}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {review.status !== "approved" && (
                        <form action={approveReviewAction.bind(null, review.id)}>
                          <button className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-[12px] font-semibold text-white">
                            <CheckCircle2 size={14} /> Approve
                          </button>
                        </form>
                      )}
                      {review.status === "approved" && (
                        <form action={toggleFeaturedReviewAction.bind(null, review.id, !review.featured)}>
                          <button className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper-2 px-3 py-2 text-[12px] font-semibold text-ink">
                            <Star size={14} /> {review.featured ? "Unfeature" : "Feature"}
                          </button>
                        </form>
                      )}
                      {review.status !== "rejected" && (
                        <form action={rejectReviewAction.bind(null, review.id)}>
                          <button className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
                            <XCircle size={14} /> Reject
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
