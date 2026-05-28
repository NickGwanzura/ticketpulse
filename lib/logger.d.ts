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
export declare const log: {
    debug: (message: string, meta?: Record<string, unknown>) => void;
    info: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, meta?: Record<string, unknown>) => void;
};
