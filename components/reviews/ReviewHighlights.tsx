import { Star } from "lucide-react"

export type ReviewHighlight = {
  id: string
  reviewerName: string
  rating: number
  title: string | null
  body: string
  eventTitle?: string | null
  createdAt?: Date | null
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "Guest"
}

export default function ReviewHighlights({
  reviews,
  title = "What guests are saying",
  compact = false,
}: {
  reviews: ReviewHighlight[]
  title?: string
  compact?: boolean
}) {
  if (reviews.length === 0) return null

  const content = (
    <>
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase">Reviews</p>
          <h2 className="mt-1 text-[24px] md:text-[30px] font-bold tracking-tight text-ink">{title}</h2>
        </div>
      </div>
      <div className={compact ? "grid gap-4" : "grid md:grid-cols-3 gap-4"}>
        {reviews.slice(0, 3).map((review) => (
          <article key={review.id} className="rounded-2xl border border-line bg-paper p-5">
            <div className="flex items-center gap-1 mb-3" aria-label={`${review.rating} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Star
                  key={value}
                  size={15}
                  className={value <= review.rating ? "fill-amber-400 text-amber-500" : "text-ink-3"}
                />
              ))}
            </div>
            {review.title && <h3 className="text-[15px] font-bold tracking-tight text-ink">{review.title}</h3>}
            <p className="mt-2 text-[14px] leading-6 text-ink-2 line-clamp-5">{review.body}</p>
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-[13px] font-semibold text-ink">{firstName(review.reviewerName)}</p>
              {review.eventTitle && <p className="mt-0.5 text-[12px] text-ink-3">{review.eventTitle}</p>}
            </div>
          </article>
        ))}
      </div>
    </>
  )

  if (compact) {
    return <div>{content}</div>
  }

  return (
    <section className="py-10 md:py-14">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        {content}
      </div>
    </section>
  )
}
