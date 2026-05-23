import { redirect, notFound } from "next/navigation"
import { eq, desc, and } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft, Users, Mail, Clock, CheckCircle, XCircle, X } from "lucide-react"

import { db } from "@/db"
import { events, users, eventOrganisers, organiserInvites } from "@/db/schema"
import { requireOwnerAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import InviteOrganiserForm from "./InviteOrganiserForm"

export const metadata = { title: "Invited organisers" }

type RouteParams = { id: string }

export default async function OrganisersPage({ params }: { params: Promise<RouteParams> }) {
  const { id } = await params

  const owner = await requireOwnerAccess(id)
  if (!owner.ok) redirect(owner.redirectTo)

  const [event] = await db
    .select({ id: events.id, title: events.title })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)

  if (!event) notFound()

  // Fetch accepted organisers with user info
  const acceptedOrganisers = await db
    .select({
      id: eventOrganisers.id,
      userId: eventOrganisers.userId,
      name: users.name,
      email: users.email,
      image: users.image,
      createdAt: eventOrganisers.createdAt,
    })
    .from(eventOrganisers)
    .leftJoin(users, eq(users.id, eventOrganisers.userId))
    .where(eq(eventOrganisers.eventId, id))
    .orderBy(desc(eventOrganisers.createdAt))

  // Fetch pending invites
  const pendingInvites = await db
    .select()
    .from(organiserInvites)
    .where(
      and(
        eq(organiserInvites.eventId, id),
        eq(organiserInvites.status, "pending"),
      ),
    )
    .orderBy(desc(organiserInvites.createdAt))

  const usedSlots = acceptedOrganisers.length
  const maxSlots = 2
  const canInvite = usedSlots < maxSlots

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title={`Organisers: ${event.title}`}
        subtitle="Invite up to 2 people to help manage this event."
        actions={
          <Link
            href={`/organizer/events/${id}`}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} />
            Back to event
          </Link>
        }
      />

      <div className="max-w-4xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-6">
        {/* Slot usage indicator */}
        <div className="rounded-2xl border border-line bg-paper p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-ink-3" />
              <span className="text-[14px] font-semibold text-ink">Organiser slots</span>
            </div>
            <span className="text-[13px] text-ink-2">
              <strong className="text-ink">{usedSlots}</strong> of {maxSlots} slots used
            </span>
          </div>
          <div className="h-2 bg-paper-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-navy rounded-full transition-all duration-500"
              style={{ width: `${(usedSlots / maxSlots) * 100}%` }}
            />
          </div>
          <p className="text-[12px] text-ink-3 mt-2">
            {canInvite
              ? `You can invite ${maxSlots - usedSlots} more organiser${maxSlots - usedSlots === 1 ? "" : "s"}.`
              : "All organiser slots are filled."}
          </p>
        </div>

        {/* Invite form */}
        {canInvite && <InviteOrganiserForm eventId={id} />}

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div className="rounded-2xl border border-dashed border-line overflow-hidden">
            <div className="px-5 py-4 border-b border-line bg-paper-2/40">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-ink-3" />
                <span className="text-[13px] font-semibold text-ink">Pending invitations</span>
              </div>
            </div>
            <div className="divide-y divide-line">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                      <Mail size={14} className="text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink truncate">{invite.email}</p>
                      <p className="text-[11.5px] text-ink-3">
                        Invited {invite.createdAt?.toLocaleDateString()} &middot;
                        Expires {invite.expiresAt.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <form action="#" method="post">
                    <input type="hidden" name="eventId" value={id} />
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <button
                      type="submit"
                      formAction={async (formData) => {
                        "use server"
                        const { cancelInviteAction } = await import("./actions")
                        await cancelInviteAction(formData)
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:text-rose-600 hover:border-rose-300 transition shrink-0"
                    >
                      <X size={12} /> Cancel
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accepted organisers */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-green-600" />
              <span className="text-[13px] font-semibold text-ink">
                Active organisers ({acceptedOrganisers.length})
              </span>
            </div>
          </div>

          {acceptedOrganisers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No invited organisers yet"
              body="Invite people to help manage this event. They'll get access to ticket sales, check-in, and staff tickets."
              variant="inline"
            />
          ) : (
            <div className="divide-y divide-line">
              {acceptedOrganisers.map((org) => (
                <div key={org.id} className="px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center shrink-0 overflow-hidden">
                      {org.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={org.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[13px] font-semibold text-blue">
                          {(org.name ?? org.email ?? "?")[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink truncate">
                        {org.name ?? "Unnamed user"}
                      </p>
                      <p className="text-[11.5px] text-ink-3">{org.email}</p>
                    </div>
                  </div>
                  <form action="#" method="post">
                    <input type="hidden" name="eventId" value={id} />
                    <input type="hidden" name="organiserId" value={org.id} />
                    <button
                      type="submit"
                      formAction={async (formData) => {
                        "use server"
                        const { removeOrganiserAction } = await import("./actions")
                        await removeOrganiserAction(formData)
                      }}
                      onClick={(e: React.MouseEvent) => {
                        if (!confirm("Remove this organiser from the event? They will lose access immediately.")) {
                          e.preventDefault()
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:text-rose-600 hover:border-rose-300 transition shrink-0"
                    >
                      <XCircle size={12} /> Remove
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
