import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
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

  // -------------------------------------------------------------------------
  // CORS — set headers explicitly before anything else, including helmet.
  // The cors npm package was not reliably setting headers in this cross-domain
  // Render deployment, so we set them directly.
  // -------------------------------------------------------------------------
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin as string | undefined;

    // Determine allowed origins from env — fall back to allowing all if unset
    const allowed = (env.FRONTEND_URL ?? '').split(',').map((o) => o.trim()).filter(Boolean);
    const allowAll = allowed.length === 0 || allowed.includes('*');

    if (origin && (allowAll || allowed.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cookie');
      res.setHeader('Access-Control-Max-Age', '86400'); // 24h preflight cache
    }

    // Respond to preflight immediately — no further middleware needed
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  });

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  // Stripe webhook must receive raw body BEFORE express.json() parses it
  app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/resumes', resumeRouter);
  app.use('/api/resumes', exportRouter);
  app.use('/api/resumes', sharingRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/points', pointsRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/public', sharingRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
