export type PlatformRole =
  | "attendee"
  | "organizer"
  | "vendor"
  | "admin"
  | "transport_operator"
  | "dispatcher"
  | "driver"
  | "conductor"

export const DASHBOARD_PATH_BY_ROLE: Record<PlatformRole, string> = {
  attendee: "/dashboard",
  organizer: "/organizer",
  vendor: "/vendors/dashboard",
  admin: "/admin",
  transport_operator: "/transport/dashboard",
  dispatcher: "/dispatch",
  driver: "/crew",
  conductor: "/crew",
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

export function isTransportOperatorRole(role: string | null | undefined): boolean {
  return role === "transport_operator"
}

export function isDispatchRole(role: string | null | undefined): boolean {
  return role === "dispatcher"
}

export function isCrewRole(role: string | null | undefined): boolean {
  return role === "driver" || role === "conductor"
}
