import type { NextFunction, Request, Response } from 'express';
import type { User } from '@prisma/client';
import { verifyAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

function extractBearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header.', 'MISSING_TOKEN');
  }
  return header.slice('Bearer '.length);
}

/** Requires a valid access token. Attaches the full current user to req.user. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req);
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedError('User no longer exists.', 'USER_NOT_FOUND');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Stricter variant for routes that should only work once email is verified
 * (e.g. resume creation, starting in the Resume Core phase). Not yet wired
 * to any route in this auth-only phase, but defined here so every later
 * phase reuses the same guard rather than re-implementing the check. */
export function requireVerifiedEmail(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(new UnauthorizedError());
    return;
  }
  if (!req.user.isEmailVerified) {
    next(new ForbiddenError('Please verify your email to access this feature.', 'EMAIL_NOT_VERIFIED'));
    return;
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(new UnauthorizedError());
    return;
  }
  if (req.user.role !== 'ADMIN') {
    next(new ForbiddenError('Admin access required.', 'ADMIN_REQUIRED'));
    return;
  }
  next();
}
