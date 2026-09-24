export type PlatformRole = "attendee" | "organizer" | "vendor" | "admin" | "superadmin"

export const DASHBOARD_PATH_BY_ROLE: Record<PlatformRole, string> = {
  attendee: "/dashboard",
  organizer: "/organizer",
  vendor: "/vendors/dashboard",
  admin: "/admin",
  superadmin: "/admin",
}

export function isPlatformRole(role: string | null | undefined): role is PlatformRole {
  return Boolean(role && Object.prototype.hasOwnProperty.call(DASHBOARD_PATH_BY_ROLE, role))
}

export function getDashboardPathForRole(role: string | null | undefined): string {
  return isPlatformRole(role) ? DASHBOARD_PATH_BY_ROLE[role] : DASHBOARD_PATH_BY_ROLE.attendee
}

export function isAdminRole(role: string | null | undefined): boolean {
  // `admin` is the persisted role today. Keep `superadmin` as a compatible
  // alias for existing sessions and future role migrations.
  return role === "admin" || role === "superadmin"
}
