import { isValidWhatsappContact } from "@/lib/phone"

export type OrganizerProfileScoreInput = {
  name: string | null
  emailVerified: Date | string | null
  phone: string | null
  organizerType: string | null
  organizerEntityName: string | null
  organizerLocation: string | null
  organizerBio: string | null
  organizerReferenceUrl: string | null
}

export type OrganizerProfileScoreItem = {
  label: string
  earned: number
  possible: number
}

export function organizerProfileScoreBreakdown(profile: OrganizerProfileScoreInput): OrganizerProfileScoreItem[] {
  const isIndividual = profile.organizerType === "individual"
  const entityProvided = Boolean(profile.organizerEntityName?.trim())

  return [
    { label: "Account name", earned: profile.name?.trim() ? 15 : 0, possible: 15 },
    { label: "Email verification link", earned: profile.emailVerified ? 20 : 0, possible: 20 },
    { label: "WhatsApp number format", earned: isValidWhatsappContact(profile.phone ?? "") ? 20 : 0, possible: 20 },
    { label: "Organizer type", earned: ["individual", "business", "community"].includes(profile.organizerType ?? "") ? 15 : 0, possible: 15 },
    { label: "City and country", earned: profile.organizerLocation?.trim() ? 15 : 0, possible: 15 },
    { label: "Organizer bio", earned: profile.organizerBio?.trim() ? 5 : 0, possible: 5 },
    { label: "Website or social reference", earned: profile.organizerReferenceUrl?.trim() ? 5 : 0, possible: 5 },
    { label: "Business or group name", earned: isIndividual || entityProvided ? 5 : 0, possible: 5 },
  ]
}

/**
 * A profile completeness aid for admin review, not an identity check or
 * compliance decision. WhatsApp points only reflect a valid-looking number;
 * the app does not verify phone ownership with an OTP.
 */
export function organizerProfileScore(profile: OrganizerProfileScoreInput): number {
  return organizerProfileScoreBreakdown(profile).reduce((score, item) => score + item.earned, 0)
}
