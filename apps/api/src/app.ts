import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { env, isProd } from './config/env.js';
import { authRouter } from './domain/auth/auth.routes.js';
import { resumeRouter } from './domain/resume/resume.routes.js';
import { exportRouter } from './domain/export/export.routes.js';
import { paymentsRouter } from './domain/payments/payments.routes.js';
import { pointsRouter } from './domain/points/points.routes.js';
import { aiRouter } from './domain/ai/ai.routes.js';
import { dashboardRouter } from './domain/dashboard/dashboard.routes.js';
import { sharingRouter } from './domain/sharing/sharing.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { profileRouter } from './domain/profile/profile.routes.js';
import { adminRouter } from './domain/admin/admin.routes.js';
import { plansRouter } from './domain/plans/plans.routes.js';
import { templatesRouter } from './domain/templates/templates.routes.js';
import { jobTrackerRouter } from './domain/jobtracker/jobtracker.routes.js';
import { jobSearchRouter } from './domain/jobsearch/jobsearch.routes.js';

export function createApp() {
  const app = express();

  // Render sits in front of the app as a single reverse-proxy hop, setting
  // X-Forwarded-For on every request. Without this, express-rate-limit
  // can't tell a real client IP from a spoofed header and throws
  // ERR_ERL_UNEXPECTED_X_FORWARDED_FOR (visible in the Render logs) instead
  // of rate-limiting correctly. `1` means "trust exactly one hop" — matches
  // Render's proxy topology without over-trusting arbitrary forwarded IPs.
  app.set('trust proxy', 1);

  // CORS — allow all origins. With the consolidated single-service deployment
  // (API serves the frontend too) there are no cross-origin requests in
  // production. This middleware is kept for local dev and future flexibility.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin as string | undefined;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cookie');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    next();
  });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // Hash of the inline <script id="cf-interactive-script"> injected by
          // injectInteractivity() (see domain/resume/previewInteractivity.ts)
          // into the live editor's interactive preview iframe (srcdoc, which
          // inherits this document's CSP). IMPORTANT: this must be computed
          // from the EVALUATED runtime string, not the raw template-literal
          // source — the source contains escaped backslashes (e.g. `\\u00D7`)
          // that collapse to single backslashes (`\u00D7`) once the JS engine
          // evaluates the template literal, and only the evaluated bytes are
          // ever actually sent to the browser. See the recompute snippet in
          // previewInteractivity.ts's file header comment.
          'script-src': [
            "'self'",
            "'sha256-Z82SP+lAk3I1MZ+8hwE18Sx73xwaTXTvnXtoholO8VI='",
            // GA4 loader (see apps/web/src/lib/analytics.ts) — no-ops with
            // no measurement ID set, but the CSP allowance is static either
            // way. Harmless if this Express app isn't the one actually
            // serving the SPA in production (see docs/deployment.md Option
            // A vs B) — an unused allowance, not a risk.
            'https://www.googletagmanager.com',
          ],
          'connect-src': ["'self'", 'https://www.google-analytics.com', 'https://*.google-analytics.com', 'https://*.analytics.google.com'],
          // Resume profile photos are served from Cloudinary (see
          // domain/uploads/cloudinary.service.ts) -- the default CSP's
          // img-src is 'self' data: only, which silently blocks the
          // browser from loading them without this.
          'img-src': ["'self'", 'data:', 'https://res.cloudinary.com'],
        },
      },
    }),
  );
  app.use(cookieParser());

  // Stripe webhook needs raw body before json parser
  app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // API routes
  app.use('/api/auth', authRouter);
  app.use('/api/resumes', resumeRouter);
  app.use('/api/resumes', exportRouter);
  app.use('/api/resumes', sharingRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/points', pointsRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/public', sharingRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/plans', plansRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/jobs', jobTrackerRouter);
  app.use('/api/job-search', jobSearchRouter);

  // Serve the React SPA in production.
  // The Dockerfile builds apps/web and copies its dist here so the API and
  // frontend run from the same process on the same domain — zero CORS needed.
  const webDist = join(process.cwd(), 'apps/web/dist');
  if (isProd && existsSync(webDist)) {
    app.use(express.static(webDist));
    // SPA fallback — any non-API path serves index.html so client-side
    // routing (/login, /resumes/:id, etc.) works on direct load or refresh.
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(join(webDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}