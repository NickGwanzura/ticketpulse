import type { ReactNode } from "react"
import { Plus, Minus } from "lucide-react"

export type FAQItem = { q: string; a: ReactNode }

interface AccordionItemProps {
  q: string
  a: ReactNode
}

export function AccordionItem({ q, a }: AccordionItemProps) {
  return (
    <details className="tp-accordion group [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex items-center gap-3 cursor-pointer focus-visible:outline-none [&:focus-visible>span:first-child]:ring-4 [&:focus-visible>span:first-child]:ring-accent/15">
        <span className="flex-1 rounded-full border border-transparent bg-paper-3 px-6 py-4 text-[15px] font-medium tracking-tight text-ink leading-snug transition-colors group-hover:bg-line/60 group-open:border-accent/40 group-open:bg-accent/[0.07] group-open:text-accent">
          {q}
        </span>
        <span
          aria-hidden="true"
          className="inline-flex w-9 h-9 shrink-0 items-center justify-center rounded-full border border-line-2 text-ink-2 transition-colors group-hover:border-ink-3 group-open:border-accent/50 group-open:text-accent"
        >
          <Plus size={15} className="group-open:hidden" />
          <Minus size={15} className="hidden group-open:block" />
        </span>
      </summary>
      <div className="tp-accordion-content">
        <div className="mt-3 ml-6 md:ml-24 mr-12 rounded-2xl rounded-tl-md bg-accent px-6 py-5 text-[14px] leading-[1.65] text-white shadow-md shadow-accent/20 [&_a]:font-semibold [&_a]:text-white [&_a]:underline">
          {a}
        </div>
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
