import express, { type Request, type Response } from 'express';
import cors from 'cors';
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

  app.use(helmet());
  // CORS: allow the configured frontend URL and localhost for dev.
  // FRONTEND_URL can be a comma-separated list if needed (e.g. preview + production).
  const allowedOrigins = (env.FRONTEND_URL ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. curl, Postman, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
    }),
  );
  app.use(cookieParser());

  // Stripe webhook must receive raw body BEFORE express.json() parses it
  app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

  // All other routes get JSON parsing
  app.use(express.json());

  // Health check — no auth, used by Render's health check and load balancers
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // Domain routers
  app.use('/api/auth', authRouter);
  app.use('/api/resumes', resumeRouter);
  app.use('/api/resumes', exportRouter);       // GET /api/resumes/:id/export/:format
  app.use('/api/resumes', sharingRouter);      // POST /api/resumes/:id/share
  app.use('/api/payments', paymentsRouter);
  app.use('/api/points', pointsRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/public', sharingRouter);       // GET /api/public/:slug (no auth)

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
