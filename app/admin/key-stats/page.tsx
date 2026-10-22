import { redirect } from "next/navigation"

/** The one-pager export now lives on Analytics; preserve old bookmarks. */
export default function AdminKeyStatsPage() {
  redirect("/admin/analytics")
}
