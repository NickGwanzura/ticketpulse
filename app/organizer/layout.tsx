import type { Metadata } from "next"
import OrganizerTopNav from "@/components/dashboard/OrganizerTopNav"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OrganizerTopNav />
      {children}
    </>
  )
}
