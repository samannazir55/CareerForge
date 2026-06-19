# =============================================================================
# CareerForge API — Dockerfile
# Multi-stage build: deps → builder → production
#
# Chromium is installed in the production stage (not builder) because it's a
# runtime dependency for Puppeteer PDF export, not a build tool. The binary
# path is baked in as an ENV so PUPPETEER_EXECUTABLE_PATH doesn't need to be
# set manually in each deployment environment.
#
# Node 20 LTS on Debian Bookworm slim chosen over Alpine because:
# 1. Puppeteer/Chromium has well-known compatibility issues on Alpine (musl vs glibc).
# 2. Prisma's native binary targets also prefer Debian.
# =============================================================================

# ---- Stage 1: Install all dependencies (including devDeps for build) --------
FROM node:20-bookworm-slim AS deps

WORKDIR /app

# Copy workspace manifests first — Docker layer cache means npm install only
# re-runs when a package.json actually changes, not on every code change.
COPY package.json ./
COPY packages/schema/package.json ./packages/schema/
COPY packages/templates/package.json ./packages/templates/
COPY apps/api/package.json ./apps/api/

RUN npm install --frozen-lockfile

# ---- Stage 2: Build TypeScript -------------------------------------------------
FROM deps AS builder

WORKDIR /app

COPY packages/schema ./packages/schema
COPY packages/templates ./packages/templates
COPY apps/api ./apps/api
COPY tsconfig.base.json ./

# Build shared packages first (API imports them)
RUN npm run build -w packages/schema
RUN npm run build -w packages/templates
RUN npm run build -w apps/api

# Generate Prisma client against the compiled schema
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# ---- Stage 3: Production image -----------------------------------------------
FROM node:20-bookworm-slim AS production

# Install Chromium and its runtime dependencies for Puppeteer PDF export.
# These are the packages Chromium requires on Debian — omitting any of them
# causes silent rendering failures or a crash on first PDF request rather than
# a clear startup error, so they're all listed explicitly.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer where to find the system Chromium — no download needed.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production

WORKDIR /app

# Copy only what's needed at runtime: compiled output + node_modules + prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/schema/dist ./packages/schema/dist
COPY --from=builder /app/packages/schema/package.json ./packages/schema/
COPY --from=builder /app/packages/templates/dist ./packages/templates/dist
COPY --from=builder /app/packages/templates/package.json ./packages/templates/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY package.json ./

# Run as a non-root user — Chromium's --no-sandbox flag (set in browser.ts)
# is required when running as root, but running as non-root is the safer
# default even with --no-sandbox present.
RUN groupadd --gid 1001 careerforge \
    && useradd --uid 1001 --gid careerforge --shell /bin/bash --create-home careerforge
USER careerforge

EXPOSE 4000

# Run migrations then start the server.
# In production (Render/Railway/Fly) you may prefer to run migrations as a
# separate release command rather than on every startup — both patterns work
# with Prisma migrate deploy.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma && node apps/api/dist/index.js"]
