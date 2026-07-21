# Corvyx — Deployment Guide

## Local development (without Docker)

```bash
cp .env.example .env          # fill in at minimum: DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
npm install
npm run db:migrate -w apps/api
npm run dev:api               # http://localhost:4000
npm run dev:web               # http://localhost:5173
```

PDF export needs a local Chromium binary:
```bash
npx puppeteer browsers install chrome
# Add the printed path to apps/api/.env:
# PUPPETEER_EXECUTABLE_PATH=/Users/you/.cache/puppeteer/chrome/...
```

---

## Local development (with Docker)

```bash
cp .env.example .env          # fill in secrets — Docker Compose reads this automatically
docker compose up             # starts postgres + api (hot-reload) + web (HMR)
docker compose up --build     # after Dockerfile changes
```

Chromium is installed inside the API container automatically — no local binary needed.

The Vite dev server (port 5173) proxies `/api` to the API container so the browser talks to one origin and cookies work without extra configuration.

To verify a production build locally:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

---

## Production deployment (Render)

Corvyx is designed to run as three separate services on Render (or equivalent):

### 1. PostgreSQL
Create a Render Postgres database. Copy the **Internal Database URL** — use this as `DATABASE_URL` in the API service (internal URLs don't incur egress costs).

### 2. API (Render Web Service)
- **Environment**: Docker
- **Dockerfile path**: `apps/api/Dockerfile`
- **Docker context**: `.` (monorepo root)
- **Port**: 4000
- **Health check path**: `/api/health`

Environment variables to set in Render:
```
DATABASE_URL              # Render Postgres internal URL
JWT_ACCESS_SECRET         # openssl rand -hex 32
JWT_REFRESH_SECRET        # openssl rand -hex 32 (different from above)
ACCESS_TOKEN_TTL_MIN      # 15
REFRESH_TOKEN_TTL_DAYS    # 30
NODE_ENV                  # production
API_PORT                  # 4000
API_BASE_URL              # https://your-api.onrender.com
FRONTEND_URL              # https://your-web.onrender.com
SMTP_HOST                 # smtp.hostinger.com (or smtp.titan.email if your mailbox is on Titan)
SMTP_PORT                 # 465
SMTP_USER                 # full mailbox address, e.g. connect@yourdomain.com
SMTP_PASSWORD             # that mailbox's password
EMAIL_FROM                # Corvyx <connect@yourdomain.com>
GOOGLE_CLIENT_ID          # from Google Cloud Console
GOOGLE_CLIENT_SECRET      #
GOOGLE_REDIRECT_URI       # https://your-api.onrender.com/api/auth/oauth/google/callback
GITHUB_CLIENT_ID          # from GitHub OAuth Apps
GITHUB_CLIENT_SECRET      #
GITHUB_REDIRECT_URI       # https://your-api.onrender.com/api/auth/oauth/github/callback
PUPPETEER_EXECUTABLE_PATH # /usr/bin/chromium  (already set in Dockerfile ENV)
STRIPE_SECRET_KEY         # sk_live_... (Phase 5)
STRIPE_WEBHOOK_SECRET     # whsec_... (Phase 5)
```

The Dockerfile installs Chromium and sets `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` automatically — you do not need to set this manually on Render unless you want to override it.

**Start command**: already baked into the Dockerfile CMD. Render will use it automatically.

**Database migrations**: the Dockerfile CMD runs `prisma migrate deploy` before starting the server on each deploy. This is safe — `migrate deploy` is idempotent and only applies pending migrations.

### 3. Web (Render Static Site — preferred, or Web Service)

**Option A — Render Static Site** (cheaper, no container needed):
- **Build command**: `npm install && npm run build -w packages/schema && npm run build -w packages/templates && npm run build -w apps/web`
- **Publish directory**: `apps/web/dist`
- **Rewrite rule**: `/*` → `/index.html` (for SPA routing)

Set these environment variables in Render's Static Site settings:
```
VITE_API_URL              # not needed if using the Nginx proxy — leave blank
VITE_GA_MEASUREMENT_ID    # your GA4 measurement ID (starts with G-). Baked in
                           # at build time — a rebuild is required after
                           # setting/changing this, not just a redeploy of the
                           # same build. See apps/web/src/lib/analytics.ts.
```

The SPA talks directly to the API's public URL. Since they're on different domains, you need to update `apps/api/src/lib/cookies.ts` to use `sameSite: 'none'` and set `secure: true` (both already safe on HTTPS). Update `FRONTEND_URL` on the API to the web app's URL.

**Option B — Render Web Service (Docker)**:
- **Dockerfile path**: `apps/web/Dockerfile`
- **Docker context**: `.`
- **Port**: 80

The Nginx container proxies `/api` to the API service via Render's private networking. Set `proxy_pass http://<your-api-private-hostname>:4000;` in `apps/web/nginx.conf` (replace the `api` hostname with Render's internal hostname for your API service).

---

## Environment variables — complete reference

See `.env.example` at the monorepo root for the full annotated list. The short version of what's required for a working production deployment:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string |
| `JWT_ACCESS_SECRET` | ✅ | Min 32 chars random string |
| `JWT_REFRESH_SECRET` | ✅ | Different from access secret |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | ✅ | OTP emails won't send without these — Hostinger/Titan mailbox credentials |
| `EMAIL_FROM` | ✅ | Must be the same mailbox address as `SMTP_USER` (or an alias on it) |
| `FRONTEND_URL` | ✅ | Used for CORS and OAuth redirects |
| `GOOGLE_CLIENT_ID/SECRET` | ⚠️ | Required only if Google login is enabled |
| `GITHUB_CLIENT_ID/SECRET` | ⚠️ | Required only if GitHub login is enabled |
| `PUPPETEER_EXECUTABLE_PATH` | ✅ | Set automatically in Dockerfile |
| `STRIPE_SECRET_KEY` | ⚠️ | Required in Phase 5 (subscriptions) |
| `VITE_GA_MEASUREMENT_ID` | ⚠️ | Optional (site works fine without it) but silent if forgotten — no error anywhere, GA4 just never receives data. Build-time only, set on the web app's build, not the API |

---

## Secrets hygiene

- Never commit `.env` to git. It is in `.gitignore`.
- The `.env` included in the original source ZIP (prior to this rebuild) contained live secrets — those should already be rotated.
- Generate secrets with `openssl rand -hex 32`.
- On Render, set secrets via the Environment tab, not as build args — build args are visible in image history.
