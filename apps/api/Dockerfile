# =============================================================================
# CareerForge API — Dockerfile
# Context: monorepo root  (docker build -f apps/api/Dockerfile .)
#
# Stage order matters:
#   1. deps      — npm install (cached layer)
#   2. builder   — prisma generate THEN tsc (order is critical)
#   3. production — minimal runtime image with Chromium for PDF export
# =============================================================================

# ---- Stage 1: Install dependencies ------------------------------------------
FROM node:20-bookworm-slim AS deps

WORKDIR /app

# Copy manifests only first — layer cache skips npm install unless a
# package.json actually changes.
COPY package.json ./
COPY packages/schema/package.json  ./packages/schema/
COPY packages/templates/package.json ./packages/templates/
COPY apps/api/package.json         ./apps/api/

RUN npm install --frozen-lockfile

# ---- Stage 2: Build ----------------------------------------------------------
FROM deps AS builder

WORKDIR /app

COPY tsconfig.base.json            ./
COPY packages/schema               ./packages/schema
COPY packages/templates            ./packages/templates
COPY apps/api                      ./apps/api

# Step A: compile the shared schema package (templates and API both import it)
RUN npm run build -w packages/schema

# Step B: generate the Prisma client BEFORE compiling TypeScript.
#         Without this, @prisma/client exports no model types (User, Resume, …)
#         and tsc fails with "has no exported member" on every Prisma type.
RUN ./node_modules/.bin/prisma generate --schema=apps/api/prisma/schema.prisma

# Step C: compile the templates package (API imports @careerforge/templates)
RUN npm run build -w packages/templates

# Step D: compile the API now that all its dependencies have types
RUN npm run build -w apps/api

# ---- Stage 3: Production runtime --------------------------------------------
FROM node:20-bookworm-slim AS production

# Chromium + its runtime dependencies for Puppeteer PDF export.
# Using system Chromium rather than Puppeteer's bundled download because:
# - Puppeteer's download is unreliable in CI/CD environments
# - System package is smaller and already security-patched by the OS
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

# Bake the path in — PUPPETEER_EXECUTABLE_PATH never needs to be set manually
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production

WORKDIR /app

# Copy only runtime artefacts — no source, no devDeps
COPY --from=builder /app/node_modules              ./node_modules
COPY --from=builder /app/packages/schema/dist      ./packages/schema/dist
COPY --from=builder /app/packages/schema/package.json ./packages/schema/
COPY --from=builder /app/packages/templates/dist   ./packages/templates/dist
COPY --from=builder /app/packages/templates/package.json ./packages/templates/
COPY --from=builder /app/apps/api/dist             ./apps/api/dist
COPY --from=builder /app/apps/api/package.json     ./apps/api/
COPY --from=builder /app/apps/api/prisma           ./apps/api/prisma
COPY package.json ./

# Non-root user — safer even with --no-sandbox
RUN groupadd --gid 1001 careerforge \
    && useradd --uid 1001 --gid careerforge --shell /bin/bash --create-home careerforge \
    && chown -R careerforge:careerforge /app
USER careerforge

EXPOSE 4000

# prisma migrate deploy is idempotent — safe to run on every startup.
# Only applies pending migrations; exits immediately if schema is current.
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --schema=apps/api/prisma/schema.prisma && node apps/api/dist/index.js"]
