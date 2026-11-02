import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ARTICLES } from "@/lib/articles"

const baseUrl = "https://ticketpulse.tech"

type Props = { params: Promise<{ slug: string }> }

function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-ZW", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Harare" }).format(new Date(value))
}

export function generateStaticParams() {
  return ARTICLES.map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = ARTICLES.find((item) => item.slug === slug)
  if (!article) return { title: "Article not found" }

  const canonical = "/articles/" + article.slug
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: article.title + " | TicketPulse",
      description: article.description,
      url: canonical,
      publishedTime: article.publishedAt,
      authors: ["TicketPulse Editorial"],
      section: article.category,
    },
    twitter: {
      card: "summary",
      title: article.title + " | TicketPulse",
      description: article.description,
    },
  }
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const article = ARTICLES.find((item) => item.slug === slug)
  if (!article) notFound()

  const canonical = baseUrl + "/articles/" + article.slug
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    articleSection: article.category,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    url: canonical,
    publisher: {
      "@type": "Organization",
      name: "TicketPulse",
      url: baseUrl,
      logo: { "@type": "ImageObject", url: baseUrl + "/ticketpulse-logo.svg" },
    },
  }

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Articles", item: baseUrl + "/articles" },
      { "@type": "ListItem", position: 3, name: article.title, item: canonical },
    ],
  }

  return (
    <main className="min-h-screen bg-paper">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema) }} />

      <div className="border-b border-line bg-paper-2">
        <nav aria-label="Breadcrumb" className="mx-auto max-w-4xl px-5 py-4 text-sm text-ink-3 md:px-8">
          <Link href="/" className="hover:text-ink hover:underline">Home</Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <Link href="/articles" className="hover:text-ink hover:underline">Articles</Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <span className="text-ink" aria-current="page">{article.title}</span>
        </nav>
      </div>

      <article className="mx-auto max-w-4xl px-5 py-10 md:px-8 md:py-16">
        <header className="border-b border-line pb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600">{article.category} · Harare, Zimbabwe</p>
          <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-ink md:text-5xl">{article.title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-2">{article.excerpt}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-3">
            <span>By TicketPulse Editorial</span>
            <time dateTime={article.publishedAt}>Published {dateLabel(article.publishedAt)}</time>
          </div>
        </header>

        <div className="prose prose-slate mt-9 max-w-none">
          {article.sections.map((section) => (
            <section key={section.heading} className="mb-9">
              <h2 className="mb-3 text-xl font-bold tracking-tight text-ink md:text-2xl">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mb-4 text-[16px] leading-8 text-ink-2">{paragraph}</p>
              ))}
              {section.event && (
                <Link href={section.event.href} className="inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-4 text-sm font-bold text-white transition hover:bg-brand-700">
                  {section.event.label} <span className="ml-2" aria-hidden="true">→</span>
                </Link>
              )}
            </section>
          ))}
        </div>

        {article.relatedEvent && (
          <aside className="mt-10 rounded-2xl border border-line bg-paper-2 p-6 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Official event listing</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Check tickets and the latest details</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">Schedules, venue information and ticket availability can change. Confirm the current details on the event page before you go.</p>
            <Link href={article.relatedEvent.href} className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-navy px-4 text-sm font-bold text-white hover:bg-navy/90">
              {article.relatedEvent.label} <span className="ml-2" aria-hidden="true">→</span>
            </Link>
          </aside>
        )}

        <div className="mt-10 flex flex-wrap gap-4 border-t border-line pt-6 text-sm">
          <Link href="/articles" className="font-semibold text-navy hover:underline">More December event guides</Link>
          <Link href="/events" className="font-semibold text-navy hover:underline">Browse all events</Link>
        </div>
      </article>
    </main>
  )
}
