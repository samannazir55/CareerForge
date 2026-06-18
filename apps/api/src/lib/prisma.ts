import { PrismaClient } from '@prisma/client';
import { isProd } from '../config/env.js';

// Standard "single PrismaClient instance" pattern, guarded against creating
// multiple clients under tsx's hot-reload in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ['error', 'warn'] : ['error', 'warn', 'query'],
  });

if (!isProd) {
  globalForPrisma.prisma = prisma;
}
