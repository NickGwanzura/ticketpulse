import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"

export type FAQItem = { q: string; a: ReactNode }

interface AccordionItemProps {
  q: string
  a: ReactNode
}

export function AccordionItem({ q, a }: AccordionItemProps) {
  return (
    <details className="tp-accordion group rounded-2xl border border-line bg-paper shadow-sm hover:border-line-2 open:border-line-2 open:ring-1 open:ring-blue/10 transition-colors [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer font-semibold text-[15px] tracking-tight text-ink leading-snug hover:bg-paper-2/40 group-open:text-navy rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue/10 transition-colors">
        <span>{q}</span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className="shrink-0 text-ink-3 transition-transform duration-200 ease-out group-open:rotate-180 group-open:text-ink-2"
        />
      </summary>
      <div className="tp-accordion-content">
        <div className="px-5 pb-5 text-[14px] text-ink-2 leading-[1.65]">{a}</div>
      </div>
    </details>
  )
}

interface FAQProps {
  items: FAQItem[]
  className?: string
}

export function FAQ({ items, className }: FAQProps) {
  return (
    <div className={`space-y-3${className ? ` ${className}` : ""}`}>
      {items.map((item, i) => (
        <AccordionItem key={i} q={item.q} a={item.a} />
      ))}
    </div>
  )
}
