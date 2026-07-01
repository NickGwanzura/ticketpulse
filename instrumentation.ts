/**
 * Next.js instrumentation hook — runs once at server startup.
 *
 * Validates critical environment variables so the app fails fast on deploy
 * rather than at runtime when a user tries to trigger a feature.
 */
export async function register() {
  // Validate SMS environment when config is present
  if (process.env.VELOCITY_SMS_BASE_URL) {
    try {
      const { getSmsEnv } = await import("@/lib/velocity/sms/env")
      getSmsEnv()
    } catch (err) {
      console.error("[instrumentation] SMS env validation failed:", (err as Error).message)
      process.exit(1)
    }
  }
}
