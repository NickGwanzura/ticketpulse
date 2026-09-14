import { auth } from "@/auth"
import { redirect } from "next/navigation"

import PageHeader from "@/components/dashboard/PageHeader"
import NewEventForm from "./NewEventForm"
import { requireApprovedOrganizer } from "@/lib/organizer-eligibility"

export const metadata = {
  title: "Create event",
}

export default async function NewEventPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin?callbackUrl=/organizer/events/new")
  if (session.user.role !== "organizer" && session.user.role !== "admin") {
    redirect("/dashboard")
  }
  if (session.user.role === "organizer") {
    const eligibility = await requireApprovedOrganizer()
    if (!eligibility.ok && eligibility.error.includes("frozen")) redirect("/organizer")
  }
  if (session.user.role === "organizer" && !session.user.approvedAt) {
    redirect("/dashboard?error=pending_approval")
  }

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title="Create a new event"
        subtitle="Save the basics first. Cover image, tickets, gallery and merch come next."
      />

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-10">
        <div className="rounded-2xl border border-line bg-paper p-6 md:p-8 tp-fade-up-1">
          <NewEventForm />
        </div>
      </div>
    </div>
  )
}
