import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft, ImageIcon, ShoppingBag, ExternalLink, Ticket, Store, Activity, Mail, Tag, Users, UserPlus, QrCode } from "lucide-react"

import { db } from "@/db"
import { events } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import EditEventForm from "./EditEventForm"

export const metadata = {
  title: "Edit event",
}

type RouteParams = { id: string }

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>
  searchParams: Promise<{ created?: string }>
}) {
  const { id } = await params
  const sp = await searchParams

  const session = await auth()
  if (!session) redirect(`/auth/signin?callbackUrl=/organizer/events/${id}/edit`)

  const [row] = await db
    .select()
    .from(events)
    .where(eq(events.id, id))
    .limit(1)

  if (!row) notFound()

  if (row.organizerId !== session.user.id && session.user.role !== "admin") {
    redirect("/organizer")
  }

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title={row.title || "Untitled event"}
        subtitle="Edit the basics, upload a cover image, and manage gallery and merch."
        actions={
          <>
            <Link
              href={`/organizer/events/${id}/tiers`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink hover:border-line-2 active:scale-[0.99] transition"
            >
              <Ticket size={15} /> Tickets
            </Link>
            <Link
              href={`/organizer/events/${id}/gallery`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink hover:border-line-2 active:scale-[0.99] transition"
            >
              <ImageIcon size={15} /> Photo gallery
            </Link>
            <Link
              href={`/organizer/events/${id}/merch`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink hover:border-line-2 active:scale-[0.99] transition"
            >
              <ShoppingBag size={15} /> Merch
            </Link>
            <Link
              href={`/organizer/events/${id}/vendors`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink hover:border-line-2 active:scale-[0.99] transition"
            >
              <Store size={15} /> Vendors
            </Link>
            <Link
              href={`/organizer/events/${id}/live`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink hover:border-line-2 active:scale-[0.99] transition"
            >
              <Activity size={15} /> Live
            </Link>
            <Link
              href={`/organizer/events/${id}/email`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink hover:border-line-2 active:scale-[0.99] transition"
            >
              <Mail size={15} /> Email
            </Link>
            <Link
              href={`/organizer/events/${id}/promos`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink hover:border-line-2 active:scale-[0.99] transition"
            >
              <Tag size={15} /> Promos
            </Link>
            <Link
              href={`/organizer/events/${id}/organisers`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink hover:border-line-2 active:scale-[0.99] transition"
            >
              <UserPlus size={15} /> Organisers
            </Link>
            <Link
              href={`/organizer/events/${id}/staff`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink hover:border-line-2 active:scale-[0.99] transition"
            >
              <QrCode size={15} /> Staff
            </Link>
            <Link
              href={`/organizer/events/${id}/attendees`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink hover:border-line-2 active:scale-[0.99] transition"
            >
              <Users size={15} /> Attendees
            </Link>
            {row.status === "published" && (
              <Link
                href={`/events/${row.slug}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 active:scale-[0.99] transition"
              >
                View live <ExternalLink size={13} />
              </Link>
            )}
          </>
        }
      />

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-4">
        <Link
          href="/organizer"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink"
        >
          <ArrowLeft size={13} /> Back to dashboard
        </Link>

        <div className="rounded-2xl border border-line bg-paper p-6 md:p-8 tp-fade-up-1">
          <EditEventForm
            event={{
              id: row.id,
              title: row.title,
              description: row.description,
              category: row.category,
              status: (row.status ?? "draft") as "draft" | "published" | "sold_out" | "cancelled" | "completed",
              venue: row.venue,
              city: row.city,
              country: row.country,
              address: row.address,
              lat: row.lat,
              lng: row.lng,
              startsAt: row.startsAt,
              endsAt: row.endsAt,
              coverImage: row.coverImage,
              tags: row.tags ?? [],
            }}
            showCreatedToast={sp.created === "1"}
          />
        </div>
      </div>
    </div>
  )
}
