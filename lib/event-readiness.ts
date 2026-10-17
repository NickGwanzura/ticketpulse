export type EventSetupEvent = {
  title: string
  description: string | null
  category: string
  venue: string
  city: string
  startsAt: Date
  endsAt: Date | null
  coverImage: string | null
}

export type EventSetupTier = {
  price: number | string
  totalQuantity: number
  salesStart: Date | null
  salesEnd: Date | null
}

export type EventSetupItem = {
  key: "details" | "image" | "tickets" | "sales"
  label: string
  href: string
  complete: boolean
  required: boolean
  detail: string
}

export function getEventSetupChecklist(
  eventId: string,
  event: EventSetupEvent,
  tiers: EventSetupTier[],
  now = new Date(),
): EventSetupItem[] {
  const hasDetails = Boolean(
    event.title.trim() && event.category.trim() && event.description?.trim() &&
    event.venue.trim() && event.city.trim() && event.startsAt > now &&
    (!event.endsAt || event.endsAt > event.startsAt),
  )
  const hasCover = Boolean(event.coverImage?.trim())
  const hasTickets = tiers.some((tier) => Number.isFinite(Number(tier.price)) && Number(tier.price) >= 0 && tier.totalQuantity > 0)
  const hasSalesWindow = tiers.some((tier) => tier.salesStart || tier.salesEnd)

  return [
    {
      key: "details",
      label: "Event details and schedule",
      href: `/organizer/events/${eventId}/edit`,
      complete: hasDetails,
      required: true,
      detail: "Add a description, venue, city, category, and future event date.",
    },
    {
      key: "image",
      label: "Cover image",
      href: `/organizer/events/${eventId}/edit`,
      complete: hasCover,
      required: true,
      detail: "A cover image helps attendees recognize your event.",
    },
    {
      key: "tickets",
      label: "Ticket tiers and capacity",
      href: `/organizer/events/${eventId}/tiers`,
      complete: hasTickets,
      required: true,
      detail: "Add at least one ticket tier with a price and available capacity.",
    },
    {
      key: "sales",
      label: "Ticket sales dates",
      href: `/organizer/events/${eventId}/tiers`,
      complete: hasSalesWindow,
      required: false,
      detail: hasSalesWindow
        ? "Sales start or end dates are set."
        : "Optional. Without dates, tickets go on sale immediately and stay available until the event.",
    },
  ]
}

export function isEventReadyForReview(items: EventSetupItem[]): boolean {
  return items.filter((item) => item.required).every((item) => item.complete)
}
