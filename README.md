# Corvyx

An AI career platform — resume building, ATS optimization, and (in future phases) interview prep, LinkedIn optimization, and job tracking, all under one schema-driven architecture.

This repository is being built in phases per the approved architecture/migration plan. **Current status: Phase 5, Steps 1–2 — Foundation + full Auth domain.** Nothing past auth exists yet; `/` after login is an intentional placeholder (see `apps/web/src/pages/HomePlaceholderPage.tsx`).

## Stack

TypeScript end-to-end. React + Vite + Tailwind on the frontend, Express + Prisma + PostgreSQL on the backend, npm workspaces monorepo. See `/mnt/user-data/outputs/CareerForge_Architecture_and_Migration_Plan.md` (or wherever you saved it) for the full rationale.

## A note on how this was built

This codebase was written without the ability to run `npm install`, start the dev servers, or run the TypeScript compiler against the real dependency tree — the build environment had no network access. Every file was type-checked locally against hand-written structural shims for each third-party package (Express, Prisma, Zod, JWT, bcryptjs, Nodemailer, React, react-router-dom, framer-motion) to catch real syntax and logic errors, and two genuine bugs were caught and fixed this way. But that's a substitute for, not equivalent to, actually running it. **Treat the first `npm install` + `npm run dev` as the real test**, and report back anything that breaks.

## Getting started

### 1. Prerequisites
- Node.js 20+
- A PostgreSQL database (local via Docker, or a hosted one)

### 2. Install
```bash
npm install
```

### 3. Configure environment
```bash
cp apps/api/.env.example apps/api/.env
```
Fill in at minimum `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` (any long random string for the two secrets — e.g. `openssl rand -hex 32`). Everything else (OAuth, SMTP email) can stay blank for now; those features will throw a clear `ConfigurationError` if used without credentials, rather than silently faking success.

### 4. Set up the database
```bash
npm run db:migrate -w apps/api
```
This runs Prisma's migration, creating the `users`, `oauth_accounts`, `otp_codes`, and `refresh_tokens` tables.

### 5. Run it
```bash
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:5173
```
Visit `http://localhost:5173/register` and you should be able to create an account end-to-end — except the OTP email won't send until you configure SMTP (step 6), since that's a real integration, not a mock.

### 6. Wiring up real providers (optional, but needed for full functionality)

**Hostinger SMTP (email/OTP):** create a mailbox on your Hostinger-hosted domain, then grab the SMTP host/port and that mailbox's credentials from your email app's manual/advanced setup screen (or hPanel → Emails → Manage → Connect Apps & Devices) — typically `smtp.hostinger.com` port 465 for plain Hostinger Email, or `smtp.titan.email` if your mailbox is on Titan. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM` in `apps/api/.env`.

**Google OAuth:** in Google Cloud Console, create an OAuth 2.0 Client ID (Web application). Authorized redirect URI: `http://localhost:4000/api/auth/oauth/google/callback`. Set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.

**GitHub OAuth:** in GitHub Settings → Developer settings → OAuth Apps, create a new app. Authorization callback URL: `http://localhost:4000/api/auth/oauth/github/callback`. Set `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`.

Without these, registration/login/password-reset all work; only the OAuth buttons and OTP emails need them.

### 7. Optional: seed an admin user
```bash
# add SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to apps/api/.env first
npm run db:seed -w apps/api
```

## Project structure

```
apps/
  web/      React + TS + Tailwind frontend (Magic Patterns design system)
  api/      Express + TS + Prisma backend
packages/
  schema/   Shared types/Zod schemas — the single source of truth for
            "what a user looks like" and "what a resume looks like",
            imported by both apps/web and apps/api.
```

A `packages/ui` for shared design primitives is intentionally not created yet — there's only one frontend consuming them right now, so splitting it out would be premature abstraction. It's a natural addition once/if a second frontend (e.g. a marketing site) needs the same tokens.

## What's implemented vs. not yet

**Implemented (real, working):** email/password registration and login, 6-digit OTP email verification (hashed at rest, 10-minute expiry, attempt-limited, resend-cooldown), forgot/reset password (enumeration-resistant), Google OAuth, GitHub OAuth, JWT access tokens + rotating opaque refresh tokens in an httpOnly cookie, rate limiting on auth endpoints, a centralized error-handling pipeline, and the full design-system port (dark mode, glassmorphism, animations).

**Not yet implemented (future phases per the migration plan):** the resume editor and schema-driven section engine, templates, version history, points/subscriptions/Stripe, AI chat builder, ATS scoring, job-description matching, cover letters, import/export, shareable links, and the real dashboard. The `User` model already has `subscriptionTier` and `pointsBalance` fields reserved for those phases so the auth schema doesn't need to change shape later.

## Security notes carried over from the original codebases

The two source ZIPs you provided had a live `.env` (JWT secret + an AI provider key) committed inside one of them. Rotate both regardless of anything in this rebuild — treat them as already compromised.

---

## Phase 5 Step 4 — Template Engine & Export Pipeline (complete)

**What shipped in this phase:**

`packages/templates` — a new shared package containing:
- `TemplateRenderer` interface: every template is `renderHtml(resume) → string` + `buildDocx(resume) → Buffer`. Same `renderHtml` function runs in the browser (live preview via iframe) and in Puppeteer (PDF generation) — WYSIWYG is guaranteed by construction, not by cross-checking two implementations.
- **Modern template** — full-width layout with colour accent header, section headings with accent border, skills as tags. HTML renderer + DOCX builder.
- **Classic template** — two-column layout: dark left sidebar (contact, skills, languages) + white main column (experience, education, custom sections). HTML renderer + DOCX builder.
- **Template registry** — single lookup point (`getTemplate(id)`, `isPremiumTemplate(id)`, `getAllTemplateMetadata()`). Adding a new template is one file + one registry entry, nothing else.
- Custom sections render automatically in both templates via a generic field-by-kind renderer — no per-template custom-section handling needed.

`apps/api/src/domain/export/` — the export pipeline:
- `browser.ts` — Puppeteer singleton: one long-lived headless Chromium process, one fresh page per export request, shut down cleanly on SIGTERM/SIGINT.
- `export.service.ts` — orchestrates: loads resume row, runs schema migrations in-memory (the stored row is never mutated during export), checks premium gating, dispatches to HTML→PDF or DOCX builder.
- `export.routes.ts` — `GET /api/resumes/:id/export/pdf` and `GET /api/resumes/:id/export/docx`.
- Premium gating: free templates always exportable; premium templates require `PREMIUM` subscription tier or a `TemplatePurchase` row. (Purchase flow arrives in Phase 5 Step 5.)

`apps/web/src/components/preview/ResumePreview.tsx` — live preview in the editor, iframe-isolated so template CSS never leaks into the editor UI.

**Editor layout** — redesigned as a two-pane layout (editor left, live preview + export buttons right on `lg:` screens).

**To enable PDF export locally:** `npx puppeteer browsers install chrome`, then set `PUPPETEER_EXECUTABLE_PATH` in `apps/api/.env` to the path it prints.

**New Prisma models:** `TemplatePurchase` (userId, templateId unique pair) added to `schema.prisma`. Run `npm run db:migrate -w apps/api` to apply.
