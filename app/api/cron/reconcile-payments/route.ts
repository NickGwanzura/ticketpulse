// Merged into recheck-velocity — both crons ran the same poll→finalize→deliver
// loop over pending Velocity orders. This file delegates to the canonical handler
// so any external cron schedules pointing here keep working without changes.
export { POST } from "@/app/api/cron/recheck-velocity/route"
