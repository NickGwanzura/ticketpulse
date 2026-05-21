#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

git add -A

git commit -m "Event organiser collaboration, typography system, scanner staff tickets, UI polish

- Event organiser collaboration: invite system (send/accept/decline), access control helpers, calendar visibility for invited organisers
- Staff tickets: generate with role/name/phone, dedicated scanner UI with staff badge + role display
- Typography system: Clash Display + General Sans (5 weights each) via next/font/local, CSS variables, responsive utility classes
- Database: event_organisers + organiser_invites tables, staff ticket columns, cancelled ticket status
- UI/UX polish: card/row accent bars on hover, decorative dot-grid empty states, page header arc SVG, scanner result slide-in with progress indicator, profile dropdown entrance animation, EmptyState visual enhancements
- Updated scanner to fall back to server action for staff tickets and unlinked codes"

RAILWAY_CALLER="skill:use-railway@1.1.3" RAILWAY_AGENT_SESSION="railway-skill-$(date +%s)-$$" railway up --detach -m "Organiser collab + typography + scanner staff + UI polish"
