-- Organizers now submit events for admin review instead of publishing directly.
ALTER TYPE "public"."event_status" ADD VALUE IF NOT EXISTS 'pending_review';
