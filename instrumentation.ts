/**
 * Next.js instrumentation hook — runs once at server startup.
 */
export async function register() {
  // validate SMS config at startup so missing env vars fail fast
  if (process.env.VELOCITY_SMS_BASE_URL) {
    try {
      const { isSmsConfigured } = await import("@/lib/velocity/env")
      if (!isSmsConfigured()) {
        console.warn("[instrumentation] SMS is partially configured — VELOCITY_SMS_BASE_URL set but no auth method found")
      }
    } catch (err) {
      console.error("[instrumentation] SMS env check failed:", (err as Error).message)
    }
  }
}
