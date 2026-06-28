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

export function createApp() {
  const app = express();

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

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
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
