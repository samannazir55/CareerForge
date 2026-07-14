import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/hash.js';
import { env } from '../src/config/env.js';

const prisma = new PrismaClient();

/**
 * Optional admin bootstrap. Only creates a row if SEED_ADMIN_EMAIL and
 * SEED_ADMIN_PASSWORD are set — this is real data creation gated on real
 * input, not placeholder/fake records, so it's safe to run against a real
 * database without polluting it with sample content.
 */
async function main() {
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
    console.log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin seed.');
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: env.SEED_ADMIN_EMAIL } });
  if (existing) {
    console.log(`Admin user ${env.SEED_ADMIN_EMAIL} already exists — skipping.`);
    return;
  }

  const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
  await prisma.user.create({
    data: {
      email: env.SEED_ADMIN_EMAIL,
      passwordHash,
      fullName: 'Corvyx Admin',
      role: 'ADMIN',
      isEmailVerified: true,
    },
  });
  console.log(`Created admin user: ${env.SEED_ADMIN_EMAIL}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
