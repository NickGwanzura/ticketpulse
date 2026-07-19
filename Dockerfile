# syntax=docker/dockerfile:1

# ─── Dependencies ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ─── Build ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars only used to satisfy Next.js's static analysis / type
# checking during `next build` — real secrets are injected at runtime below.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# `output: "standalone"` produces a self-contained server.js plus only the
# node_modules it needs — copy just that, plus static assets it doesn't bundle.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# busybox wget, not a node -e probe: spawning a full Node process per probe
# costs ~100MB+ and seconds of cold start, which on a loaded shared host blew
# past even a 15s timeout and got healthy containers killed as "unhealthy".
HEALTHCHECK --interval=30s --timeout=15s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:$PORT/api/health" || exit 1

CMD ["node", "server.js"]
