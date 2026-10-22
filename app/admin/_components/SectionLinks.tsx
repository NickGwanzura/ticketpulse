import Link from "next/link"

export default function SectionLinks({
  label,
  links,
}: {
  label: string
  links: { label: string; href: string }[]
}) {
  return (
    <nav aria-label={label} className="mb-6 flex flex-wrap gap-2">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="rounded-lg border border-line bg-paper px-3 py-2 text-[12px] font-semibold text-ink hover:border-line-2 hover:bg-paper-2">
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
