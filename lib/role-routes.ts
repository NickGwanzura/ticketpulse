export type PlatformRole = "attendee" | "organizer" | "vendor" | "admin"

export const DASHBOARD_PATH_BY_ROLE: Record<PlatformRole, string> = {
  attendee: "/dashboard",
  organizer: "/organizer",
  vendor: "/vendors/dashboard",
  admin: "/admin",
}

export function isPlatformRole(role: string | null | undefined): role is PlatformRole {
  return Boolean(role && role in DASHBOARD_PATH_BY_ROLE)
}

export function getDashboardPathForRole(role: string | null | undefined): string {
  return isPlatformRole(role) ? DASHBOARD_PATH_BY_ROLE[role] : DASHBOARD_PATH_BY_ROLE.attendee
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin"
}
