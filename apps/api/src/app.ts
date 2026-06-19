import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { authRouter } from './domain/auth/auth.routes.js';
import { resumeRouter } from './domain/resume/resume.routes.js';
import { exportRouter } from './domain/export/export.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true, // required so the browser sends/accepts the refresh cookie
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/resumes', resumeRouter);
  // Export routes share the /api/resumes prefix so URLs are:
  // GET /api/resumes/:id/export/pdf
  // GET /api/resumes/:id/export/docx
  app.use('/api/resumes', exportRouter);

  // Future domain routers mount here, each in its own file, e.g.:
  // app.use('/api/templates', templateRouter);
  // app.use('/api/points', pointsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
