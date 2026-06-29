import { prisma } from '../../lib/prisma.js';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';
import { computeCompleteness } from './completeness.js';
import type { UpsertProfileFactRequest, ProfileWithFacts } from '@careerforge/schema';
import type { ProfileFact } from '@prisma/client';

/**
 * Ensures a CareerProfile exists for the given user, creating one if absent.
 * Called during registration and OAuth login for new users.
 * Safe to call multiple times — idempotent.
 */
export async function ensureCareerProfile(userId: string): Promise<string> {
  const existing = await prisma.careerProfile.findUnique({ where: { userId } });
  if (existing) return existing.id;

  const created = await prisma.careerProfile.create({ data: { userId } });
  return created.id;
}

/**
 * Returns the full profile with facts and computed completeness for the
 * authenticated user. Throws NotFoundError only if somehow the profile
 * row was deleted (shouldn't happen in normal operation).
 */
export async function getProfile(userId: string): Promise<ProfileWithFacts> {
  const profile = await prisma.careerProfile.findUnique({
    where: { userId },
    include: {
      facts: {
        orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!profile) {
    // Profile is auto-created on registration. If missing here, auto-repair.
    await ensureCareerProfile(userId);
    return getProfile(userId);
  }

  const completeness = computeCompleteness(profile.facts);

  return {
    id: profile.id,
    userId: profile.userId,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    facts: profile.facts.map(serializeFact),
    completeness,
  };
}

/**
 * Upserts a single fact by its namespaced key. Existing fact at the same
 * key is updated; absent fact is created. The `@@unique([profileId, key])`
 * constraint in Prisma makes this atomic.
 */
export async function upsertFact(
  userId: string,
  input: UpsertProfileFactRequest,
): Promise<ProfileFact> {
  const profile = await prisma.careerProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundError('Career profile not found.');

  const fact = await prisma.profileFact.upsert({
    where: { profileId_key: { profileId: profile.id, key: input.key } },
    create: {
      profileId: profile.id,
      category: input.category,
      key: input.key,
      value: input.value as object,
      confidenceScore: input.confidenceScore ?? 100,
      source: input.source ?? 'USER_CONFIRMED',
      lastVerifiedAt: new Date(),
    },
    update: {
      value: input.value as object,
      confidenceScore: input.confidenceScore ?? 100,
      source: input.source ?? 'USER_CONFIRMED',
      lastVerifiedAt: new Date(),
    },
  });

  return fact;
}

/**
 * Deletes a specific fact by key. Throws if the profile or fact is not found.
 */
export async function deleteFact(userId: string, key: string): Promise<void> {
  const profile = await prisma.careerProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundError('Career profile not found.');

  const deleted = await prisma.profileFact.deleteMany({
    where: { profileId: profile.id, key },
  });

  if (deleted.count === 0) throw new NotFoundError(`Fact "${key}" not found.`);
}

/**
 * Returns facts for a specific category, ordered by creation time.
 */
export async function getFactsByCategory(
  userId: string,
  category: string,
): Promise<ProfileFact[]> {
  const profile = await prisma.careerProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundError('Career profile not found.');

  return prisma.profileFact.findMany({
    where: { profileId: profile.id, category: category as ProfileFact['category'] },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Batch upsert — used by the AI tool executor to apply multiple fact
 * updates from a single conversation turn without N+1 round trips.
 */
export async function batchUpsertFacts(
  userId: string,
  inputs: UpsertProfileFactRequest[],
): Promise<void> {
  if (inputs.length === 0) return;

  const profile = await prisma.careerProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundError('Career profile not found.');

  // Prisma does not support ON CONFLICT DO UPDATE in createMany, so we use
  // a transaction of individual upserts. Input arrays from the AI are
  // typically 1–5 items per turn, so this is not a performance concern.
  await prisma.$transaction(
    inputs.map((input) =>
      prisma.profileFact.upsert({
        where: { profileId_key: { profileId: profile.id, key: input.key } },
        create: {
          profileId: profile.id,
          category: input.category,
          key: input.key,
          value: input.value as object,
          confidenceScore: input.confidenceScore ?? 50,
          source: input.source ?? 'AI_INFERRED',
        },
        update: {
          value: input.value as object,
          confidenceScore: input.confidenceScore ?? 50,
          source: input.source ?? 'AI_INFERRED',
        },
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Internal serializer — converts Prisma's Date objects to ISO strings
// ---------------------------------------------------------------------------

function serializeFact(fact: ProfileFact) {
  return {
    id: fact.id,
    profileId: fact.profileId,
    category: fact.category,
    key: fact.key,
    value: fact.value,
    confidenceScore: fact.confidenceScore,
    source: fact.source,
    lastVerifiedAt: fact.lastVerifiedAt?.toISOString() ?? null,
    createdAt: fact.createdAt.toISOString(),
    updatedAt: fact.updatedAt.toISOString(),
  };
}