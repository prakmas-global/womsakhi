# syntax=docker/dockerfile:1
#
# WomSakhi web — Next.js 16.2.7 on Cloud Run.
#
# Three stages so the runtime image carries neither the toolchain nor the
# source: deps installs, builder compiles, runner holds only the standalone
# output. Node 24 to match what the app is developed and tested on; a Next
# build is sensitive to the major version and "it built on my machine" is not
# a deployment strategy.

# ── deps ──────────────────────────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` first, because it installs exactly the lockfile and fails loudly on
# drift — which is the point of committing one.
#
# The fallback is not laziness. `@tailwindcss/oxide-wasm32-wasi` declares
# `@emnapi/core` and `@emnapi/runtime` as dependencies, but npm only resolves
# wasm32-wasi packages on a platform that can use them — so a lockfile
# generated on macOS is missing two entries that `npm ci` on linux then
# demands, and no amount of regenerating it on macOS adds them. It is an npm
# optional-dependency bug, not a drifted lockfile. `npm install` resolves the
# same tree and fills the two gaps; if the lockfile has genuinely drifted, the
# build still succeeds but the first line will have told you so in the log.
RUN npm ci --no-audit --no-fund || \
    (echo ">>> npm ci failed; falling back to npm install (see Dockerfile)" && \
     npm install --no-audit --no-fund)

# ── builder ───────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Baked into the client bundle at build time, so it must be present HERE and
# not merely at runtime. A NEXT_PUBLIC_* variable supplied only to the running
# container is `undefined` in the browser, and every API call goes to the page's
# own origin instead — a 404 storm that looks like a routing fault.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── runner ────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Not root. Cloud Run does not require it, but a container that never needs to
# write outside /tmp has no reason to be able to.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/.next/standalone ./
# The two the standalone server does not bring with it. See next.config.ts.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
# Cloud Run injects PORT and it is not negotiable — bind to it rather than to
# a number of our own choosing, or the service never passes its health check.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
EXPOSE 8080
CMD ["node", "server.js"]
