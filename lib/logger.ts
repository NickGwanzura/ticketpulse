/**
 * Minimal structured logger.
 *
 * Usage:
 *   import { log } from "@/lib/logger"
 *   log.info("order placed", { orderId, amount })
 *   log.error("payment failed", { orderId, error: err.message })
 *
 * In production, pipe stdout to your log-aggregation system (CloudWatch,
 * Logtail, Axiom, etc.). Each line is a single JSON object for easy parsing.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const
type Level = keyof typeof LEVELS

const currentLevel: Level =
  process.env.NODE_ENV === "production" ? "info" : "debug"

function emit(level: Level, message: string, meta?: Record<string, unknown>) {
  if (LEVELS[level] < LEVELS[currentLevel]) return

  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta } : {}),
  }

  const line = JSON.stringify(entry)

  switch (level) {
    case "error":
      console.error(line)
      break
    case "warn":
      console.warn(line)
      break
    default:
      console.log(line)
  }
}

export const log = {
  debug: (message: string, meta?: Record<string, unknown>) => emit("debug", message, meta),
  info:  (message: string, meta?: Record<string, unknown>) => emit("info",  message, meta),
  warn:  (message: string, meta?: Record<string, unknown>) => emit("warn",  message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit("error", message, meta),
}
