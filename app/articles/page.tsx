import type { Metadata } from "next"
import Link from "next/link"
import { ARTICLES } from "@/lib/articles"

export const metadata: Metadata = {
  title: "December 2026 Event Guides for Harare",
  description: "Read TicketPulse guides to December 2026 events in Harare, from live music and late-night parties to New Year's Eve.",
  alternates: { canonical: "/articles" },
  openGraph: {
    title: "December 2026 Event Guides for Harare | TicketPulse",
    description: "Plan December with event guides for live music, parties and New Year's Eve in Harare.",
    url: "/articles",
    type: "website",
  },
}

function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}

export default function ArticlesPage() {
  const baseUrl = "https://ticketpulse.tech"
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "December 2026 Event Guides for Harare",
    description: metadata.description,
    url: baseUrl + "/articles",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: ARTICLES.map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: baseUrl + "/articles/" + article.slug,
        name: article.title,
      })),
    },
  }

  return (
    <main className="min-h-screen bg-paper">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      <header className="bg-navy px-5 py-16 text-white md:px-8 md:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-200">TicketPulse journal · Harare, Zimbabwe</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">December event guides</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
            Practical guides to live music, parties and end-of-year events listed on TicketPulse for December 2026.
          </p>
          <Link href="/events" className="mt-7 inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700">
            Browse all events
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Event ideas and details</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink md:text-3xl">Plan a December night out</h2>
          </div>
          <p className="text-sm text-ink-3">Updated 2 November 2026</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {ARTICLES.map((article) => (
            <article key={article.slug} className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600">{article.category}</p>
              <h3 className="mt-3 text-xl font-bold leading-snug text-ink">
                <Link href={"/articles/" + article.slug} className="hover:underline">{article.title}</Link>
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-2">{article.excerpt}</p>
              <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
                <time dateTime={article.publishedAt} className="text-xs text-ink-3">2 Nov 2026</time>
                <Link href={"/articles/" + article.slug} className="text-sm font-bold text-navy hover:underline">Read guide <span aria-hidden="true">→</span></Link>
              </div>
            </article>
          ))}
        </div>

        <aside className="mt-12 rounded-2xl border border-line bg-paper-2 p-6 md:p-8">
          <h2 className="text-xl font-bold text-ink">Looking for a specific date?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">The events calendar is the source for current listings, schedules and ticket availability. Check an event page before you travel because details can change.</p>
          <Link href="/events" className="mt-4 inline-flex text-sm font-bold text-navy hover:underline">Open the December event calendar →</Link>
        </aside>
      </div>
    </main>
  )
}
