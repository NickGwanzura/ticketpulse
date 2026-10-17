/**
 * WhatsApp contact check shared by sign-up, onboarding and the dashboard gate.
 * Accepts Zimbabwean numbers in any local/+263 form, or any international
 * number written with a leading + and country code (8 to 15 digits, E.164).
 */
const ZIMBABWE = /^(\+?263|0)?7[1789]\d{7}$/
const INTERNATIONAL = /^\+[1-9]\d{7,14}$/

export function isValidWhatsappContact(value: string | null | undefined): boolean {
  const compact = (value ?? "").replace(/[\s()-]/g, "")
  return ZIMBABWE.test(compact) || INTERNATIONAL.test(compact)
}
