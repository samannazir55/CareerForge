# =============================================================================
# CareerForge Web — Dockerfile
# Multi-stage build: deps → builder → production (Nginx static file server)
#
# The web app is a pure client-side React SPA — it has no Node runtime in
# production. Vite builds it to static files; Nginx serves them and handles
# the SPA routing (all paths fall back to app-shell.html).
#
# The build also runs a prerender step (apps/web/scripts/prerender.mjs) that
# uses headless Chromium via Puppeteer to render each public page to real
# static HTML. Chromium is only needed at BUILD time — the final production
# stage is still just Nginx with static files, nothing added there.
#
# The /api proxy that Vite's dev server provides (vite.config.ts) does NOT
# exist in this Nginx container. In production, put both the web container
# and the API container behind a reverse proxy (e.g. Caddy, Nginx, or your
# hosting platform's load balancer) so /api requests route to the API
# container and everything else routes here. The docker-compose.prod.yml
# shows one way to set this up locally.
# =============================================================================

# ---- Stage 1: Install dependencies ------------------------------------------
FROM node:20-bookworm-slim AS deps

WORKDIR /app

# Chromium (for the build-time prerender step) + its runtime libraries.
# Installed via apt rather than letting Puppeteer download its own copy —
# smaller image, no dependency on an external Chrome download endpoint
# being reachable during the build.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package.json ./
COPY packages/schema/package.json ./packages/schema/
COPY packages/templates/package.json ./packages/templates/
COPY apps/web/package.json ./apps/web/

RUN npm install

# ---- Stage 2: Build ---------------------------------------------------------
FROM deps AS builder

WORKDIR /app

COPY packages/schema ./packages/schema
COPY packages/templates ./packages/templates
COPY apps/web ./apps/web
COPY tsconfig.base.json ./

# Build shared packages that the web app imports at bundle time
RUN npm run build -w packages/schema
RUN npm run build -w packages/templates
RUN npm run build -w apps/web

# ---- Stage 3: Serve with Nginx ----------------------------------------------
FROM nginx:1.27-alpine AS production

# Custom Nginx config: serve prerendered public pages as static HTML, fall
# back to app-shell.html for client-side routing on everything else, and
# proxy /api to the API service.
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
