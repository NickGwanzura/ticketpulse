import type { Instrumentation } from "next"

import { log } from "@/lib/logger"

export async function register() {
  log.info("application instrumentation registered", {
    environment: process.env.NODE_ENV,
    release: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "unknown",
  })

  if (process.env.VELOCITY_SMS_BASE_URL) {
    try {
      const { isSmsConfigured } = await import("@/lib/velocity/env")
      if (!isSmsConfigured()) {
        log.warn("SMS is partially configured", { reason: "VELOCITY_SMS_BASE_URL is set but no authentication method is available" })
      }
    } catch (error) {
      log.error("SMS environment validation failed", { error: String(error) })
    }
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  log.error("unhandled request error", {
    error: error instanceof Error ? error.message : String(error),
    digest: error instanceof Error && "digest" in error ? String(error.digest) : undefined,
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    routePath: context.routePath,
  })
}
