import { redirect } from "next/navigation"

/**
 * Organisers work from their attendee list, not from order management
 * (payments, recovery and refunds are handled by TicketPulse support).
 */
export default function OrganizerOrdersRedirect() {
  redirect("/organizer/attendees")
}
