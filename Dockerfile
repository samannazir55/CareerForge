# =============================================================================
# CareerForge — Root Dockerfile (single service: API + frontend)
#
# The API serves the React frontend as static files in production.
# One service, one domain, zero CORS.
# =============================================================================

# ---- Stage 1: Install dependencies ------------------------------------------
    FROM node:20-bookworm-slim AS deps

    RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

    WORKDIR /app
    
    COPY package.json ./
    COPY packages/schema/package.json     ./packages/schema/
    COPY packages/templates/package.json  ./packages/templates/
    COPY apps/api/package.json            ./apps/api/
    COPY apps/web/package.json            ./apps/web/
    
    RUN npm install
    
    # ---- Stage 2: Build ----------------------------------------------------------
    FROM deps AS builder
    
    WORKDIR /app
    
    COPY tsconfig.base.json ./
    COPY packages/schema    ./packages/schema
    COPY packages/templates ./packages/templates
    COPY apps/api           ./apps/api
    COPY apps/web           ./apps/web
    
    # 1. Shared schema (both API and web depend on it)
    RUN npm run build -w packages/schema
    
    # 2. Generate Prisma client before compiling TypeScript
    RUN ./node_modules/.bin/prisma generate --schema=apps/api/prisma/schema.prisma
    
    # 3. Templates (API imports for PDF/DOCX export and preview)
    RUN npm run build -w packages/templates
    
    # 4. API
    RUN npm run build -w apps/api
    
    # 5. Web frontend (served statically from the API process)
    # Render auto-forwards dashboard env vars as Docker build args, but only for
    # ARGs the Dockerfile explicitly declares — anything undeclared is silently
    # dropped before it ever reaches `npm run build`. VITE_GA_MEASUREMENT_ID is
    # read by Vite at build time (see apps/web/src/lib/analytics.ts), so it has
    # to be captured here, not just set in Render's Environment tab.
    ARG VITE_GA_MEASUREMENT_ID
    ENV VITE_GA_MEASUREMENT_ID=$VITE_GA_MEASUREMENT_ID
    RUN npm run build -w apps/web
    
    # ---- Stage 3: Production runtime --------------------------------------------
    FROM node:20-bookworm-slim AS production
    
    # Chromium for Puppeteer PDF export
    RUN apt-get update && apt-get install -y --no-install-recommends \
        chromium \
        fonts-liberation \
        fonts-noto-color-emoji \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libdrm2 \
        libgbm1 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libx11-xcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxi6 \
        libxkbcommon0 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
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
    # Frontend static files — served by Express in production
    COPY --from=builder /app/apps/web/dist              ./apps/web/dist
    COPY package.json ./
    
    RUN groupadd --gid 1001 careerforge \
        && useradd --uid 1001 --gid careerforge --shell /bin/bash --create-home careerforge \
        && chown -R careerforge:careerforge /app
    USER careerforge
    
    EXPOSE 4000
    
    CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --schema=apps/api/prisma/schema.prisma && node apps/api/dist/index.js"]