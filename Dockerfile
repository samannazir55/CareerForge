# =============================================================================
# CareerForge — Root Dockerfile (API service)
#
# Render picks this up when the repo root is set as the Docker context and no
# specific Dockerfile path is configured. It builds the API service only.
# The web app is deployed separately as a static site (see docs/deployment.md).
#
# This file is intentionally identical in behaviour to apps/api/Dockerfile.
# Having it at the root removes the need to configure a custom Dockerfile path
# in Render — sensible defaults work out of the box.
# =============================================================================

# ---- Stage 1: Install dependencies ------------------------------------------
FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY package.json ./
COPY packages/schema/package.json     ./packages/schema/
COPY packages/templates/package.json  ./packages/templates/
COPY apps/api/package.json            ./apps/api/

RUN npm install --frozen-lockfile

# ---- Stage 2: Build ----------------------------------------------------------
FROM deps AS builder

WORKDIR /app

COPY tsconfig.base.json ./
COPY packages/schema    ./packages/schema
COPY packages/templates ./packages/templates
COPY apps/api           ./apps/api

# 1. Compile shared schema package
RUN npm run build -w packages/schema

# 2. Generate Prisma client — MUST happen before tsc runs on apps/api.
#    Without this step @prisma/client has no model types and the build fails
#    with "has no exported member 'User'" / 'Resume' / 'OAuthProviderName' etc.
RUN ./node_modules/.bin/prisma generate --schema=apps/api/prisma/schema.prisma

# 3. Compile templates package (API imports @careerforge/templates)
RUN npm run build -w packages/templates

# 4. Compile API — all dependencies now have types
RUN npm run build -w apps/api

# ---- Stage 3: Production runtime --------------------------------------------
FROM node:20-bookworm-slim AS production

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

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app/node_modules               ./node_modules
COPY --from=builder /app/packages/schema/dist       ./packages/schema/dist
COPY --from=builder /app/packages/schema/package.json ./packages/schema/
COPY --from=builder /app/packages/templates/dist    ./packages/templates/dist
COPY --from=builder /app/packages/templates/package.json ./packages/templates/
COPY --from=builder /app/apps/api/dist              ./apps/api/dist
COPY --from=builder /app/apps/api/package.json      ./apps/api/
COPY --from=builder /app/apps/api/prisma            ./apps/api/prisma
COPY package.json ./

RUN groupadd --gid 1001 careerforge \
    && useradd --uid 1001 --gid careerforge --shell /bin/bash --create-home careerforge
USER careerforge

EXPOSE 4000

CMD ["sh", "-c", "./node_modules/.bin/prisma db push --schema=apps/api/prisma/schema.prisma && node apps/api/dist/index.js"]
