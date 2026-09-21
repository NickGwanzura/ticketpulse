import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export interface LegalSection {
  id: string
  title: string
  body: React.ReactNode
}

interface LegalLayoutProps {
  kicker: string
  title: string
  lastUpdated: string
  intro: string
  sections: LegalSection[]
}

export default function LegalLayout({ kicker, title, lastUpdated, intro, sections }: LegalLayoutProps) {
  return (
    <div>
      <section className="border-b border-line bg-paper-2">
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-12 md:pt-16 pb-10 md:pb-14">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink transition-colors mb-6">
            <ArrowLeft size={13} /> Home
          </Link>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">{kicker}</p>
          <h1 className="text-[32px] md:text-[44px] font-bold tracking-[-0.02em] leading-[1.05] text-ink">{title}</h1>
          <p className="mt-3 text-[14px] text-ink-3">Last updated {lastUpdated}</p>
          <p className="mt-5 text-[15px] md:text-[16px] text-ink-2 max-w-2xl leading-relaxed">{intro}</p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-12 md:py-16">
        <div className="grid lg:grid-cols-[200px_1fr] gap-10">
          {/* ToC */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-3 uppercase mb-3">Contents</p>
              <ul className="space-y-2">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="text-[13px] text-ink-2 hover:text-ink transition-colors leading-snug block"
                    >
                      <span className="text-ink-3 font-mono mr-2">{String(i + 1).padStart(2, "0")}</span>
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Sections */}
          <article className="space-y-12">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">
                  {String(i + 1).padStart(2, "0")} · {s.title.split(" ").slice(0, 2).join(" ")}
                </p>
                <h2 className="text-[22px] md:text-[26px] font-bold tracking-tight leading-tight text-ink mb-4">{s.title}</h2>
                <div className="text-[15px] leading-relaxed text-ink-2 space-y-3 [&_a]:text-link [&_a]:font-semibold [&_a:hover]:underline [&_strong]:text-ink [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_li]:marker:text-ink-3">
                  {s.body}
                </div>
              </section>
            ))}
          </article>
        </div>

        <div className="mt-16 pt-8 border-t border-line text-center">
          <p className="text-[13px] text-ink-3">Questions? <Link href="/contact" className="text-navy font-semibold hover:underline">Contact us</Link>.</p>
        </div>
      </div>
    </div>
  )
}
