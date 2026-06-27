// Shared, client-safe constants for the R2 upload pipeline.
// `lib/r2.ts` (server-only) and `components/ui/ImageUploader.tsx` (client)
// both import from here so the limits stay in one place.

export const UPLOAD_LIMITS = {
  avatar:             2  * 1024 * 1024, // 2 MB
  "vendor-logo":      2  * 1024 * 1024, // 2 MB
  "vendor-portfolio": 8  * 1024 * 1024, // 8 MB per image
  "event-cover":      5  * 1024 * 1024, // 5 MB
  "event-promo":      5  * 1024 * 1024, // 5 MB per promo photo
  "event-gallery":    10 * 1024 * 1024, // 10 MB per photo
  merch:              5  * 1024 * 1024, // 5 MB
} as const

export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const

export type UploadKind = keyof typeof UPLOAD_LIMITS
export type AllowedMime = (typeof ALLOWED_IMAGE_MIME)[number]
