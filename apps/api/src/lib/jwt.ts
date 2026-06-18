import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from './errors.js';

export interface AccessTokenPayload {
  sub: string; // userId
  email: string;
  role: 'USER' | 'ADMIN';
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m`,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired access token', 'INVALID_ACCESS_TOKEN');
  }
}
