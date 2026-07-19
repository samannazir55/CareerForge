import { prisma } from '../../lib/prisma.js';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';
import { computeCompleteness } from './completeness.js';
import { sanitise } from '../../lib/sanitise.js';
import type {
  UpsertProfileFactRequest,
  ProfileWithFacts,
  UpdatePublicProfileSettingsRequest,
  CareerProfileWithPublicFields,
  PublicProfile,
  PublicResumeSummary,
  SkillValue,
} from '@careerforge/schema';
import type { ProfileFact } from '@prisma/client';
import { getAllTemplateMetadata } from '@careerforge/templates';

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
// Public portfolio — /u/:slug
// ---------------------------------------------------------------------------

const CODE_TEMPLATE_NAMES = new Map(getAllTemplateMetadata().map((t) => [t.id, t.name]));

/**
 * Looks up a display name for a templateId without needing the full
 * ResolvedTemplate machinery in templateResolver.ts (which builds render
 * functions we don't need here) — checks the code registry first, then
 * DynamicTemplate rows, matching the same precedence as the resolver.
 */
async function getTemplateName(templateId: string): Promise<string> {
  const codeName = CODE_TEMPLATE_NAMES.get(templateId);
  if (codeName) return codeName;

  const dynamic = await prisma.dynamicTemplate.findUnique({
    where: { id: templateId },
    select: { name: true },
  });
  return dynamic?.name ?? 'Custom';
}

/**
 * Returns the public-facing portfolio for a published profile. Callers
 * (the /u/:slug route) get a 404-equivalent NotFoundError both when the
 * slug doesn't exist and when it exists but isPublic is false — a private
 * profile's existence isn't revealed to unauthenticated visitors.
 *
 * `viewerUserId`, if provided and equal to the profile's own owner, lets
 * the owner preview their unpublished (isPublic: false) page before going
 * live — see the optional-auth check in the /public/:slug route handler.
 * Any other viewer, authenticated or not, still gets the 404 gate.
 *
 * Known tradeoff: the same lookup path backs the settings page's slug
 * availability check, so a slug that's taken by someone whose profile is
 * currently private will read as "available" in that debounced check.
 * The actual source of truth is the unique constraint on publicSlug,
 * enforced in updatePublicProfileSettings below — the availability check
 * is advisory UI, not the final gate.
 */
export async function getPublicProfileBySlug(slug: string, viewerUserId?: string): Promise<PublicProfile> {
  const profile = await prisma.careerProfile.findUnique({
    where: { publicSlug: slug.toLowerCase() },
    include: {
      user: { select: { fullName: true } },
      facts: { where: { category: 'SKILL' } },
    },
  });

  const isOwner = Boolean(viewerUserId) && profile?.userId === viewerUserId;
  if (!profile || (!profile.isPublic && !isOwner)) {
    throw new NotFoundError('Public profile not found.');
  }

  const resumes = await prisma.resume.findMany({
    where: { ownerId: profile.userId, shareableLink: { isEnabled: true } },
    include: { shareableLink: true },
  });

  const publicResumes: PublicResumeSummary[] = await Promise.all(
    resumes.map(async (resume) => {
      const templateId = (resume.theme as { templateId?: string })?.templateId ?? 'modern';
      return {
        id: resume.id,
        title: resume.title,
        templateId,
        templateName: await getTemplateName(templateId),
        // shareableLink is guaranteed non-null by the `isEnabled: true`
        // filter above, but Prisma's include type can't express that.
        slug: resume.shareableLink!.slug,
        viewCount: resume.shareableLink!.viewCount,
      };
    }),
  );

  const totalResumeViews = await prisma.resumeView.count({
    where: { resume: { ownerId: profile.userId } },
  });

  const skills = profile.facts
    .map((f) => (f.value as SkillValue | null)?.name)
    .filter((name): name is string => Boolean(name));

  return {
    fullName: profile.user.fullName,
    headline: profile.headline,
    bio: profile.bio,
    location: profile.location,
    website: profile.website,
    linkedinUrl: profile.linkedinUrl,
    githubUrl: profile.githubUrl,
    twitterUrl: profile.twitterUrl,
    avatarUrl: profile.avatarUrl,
    isPublic: profile.isPublic,
    publicResumes,
    skills,
    totalResumeViews,
  };
}

/**
 * Returns the caller's own public-portfolio settings (as opposed to
 * getPublicProfileBySlug, which is the no-auth /u/:slug view of someone
 * else's published profile). Not explicitly listed in the original spec's
 * two endpoints, but needed so the settings page in CareerProfilePage.tsx
 * has something to populate its fields with on mount — added as a GET
 * companion to PATCH /public-settings, mirroring the existing
 * GET+PATCH /notifications/preferences pattern elsewhere in this codebase.
 */
export async function getPublicProfileSettings(userId: string): Promise<CareerProfileWithPublicFields> {
  const profile = await prisma.careerProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundError('Career profile not found.');

  return {
    id: profile.id,
    userId: profile.userId,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    publicSlug: profile.publicSlug,
    isPublic: profile.isPublic,
    headline: profile.headline,
    bio: profile.bio,
    location: profile.location,
    website: profile.website,
    linkedinUrl: profile.linkedinUrl,
    githubUrl: profile.githubUrl,
    twitterUrl: profile.twitterUrl,
    avatarUrl: profile.avatarUrl,
  };
}

/**
 * Updates the caller's public-portfolio settings. Empty-string values for
 * the URL fields (website/linkedinUrl/githubUrl/twitterUrl) are treated as
 * "clear this field" — the zod schema allows '' specifically so the
 * settings page can send a blanked-out input without a separate "unset"
 * affordance.
 */
export async function updatePublicProfileSettings(
  userId: string,
  input: UpdatePublicProfileSettingsRequest,
): Promise<CareerProfileWithPublicFields> {
  const profile = await prisma.careerProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundError('Career profile not found.');

  if (input.publicSlug && input.publicSlug !== profile.publicSlug) {
    const existing = await prisma.careerProfile.findUnique({ where: { publicSlug: input.publicSlug } });
    if (existing && existing.userId !== userId) {
      throw new BadRequestError(`The URL "${input.publicSlug}" is already taken.`, 'SLUG_TAKEN');
    }
  }

  const toNullable = (v: string | undefined) => (v === '' ? null : v);

  const updated = await prisma.careerProfile.update({
    where: { userId },
    data: {
      publicSlug: input.publicSlug,
      isPublic: input.isPublic,
      headline: input.headline !== undefined ? sanitise(input.headline, 150) : undefined,
      bio: input.bio !== undefined ? sanitise(input.bio, 1000) : undefined,
      location: input.location !== undefined ? sanitise(input.location, 200) : undefined,
      website: toNullable(input.website),
      linkedinUrl: toNullable(input.linkedinUrl),
      githubUrl: toNullable(input.githubUrl),
      twitterUrl: toNullable(input.twitterUrl),
    },
  });

  return {
    id: updated.id,
    userId: updated.userId,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    publicSlug: updated.publicSlug,
    isPublic: updated.isPublic,
    headline: updated.headline,
    bio: updated.bio,
    location: updated.location,
    website: updated.website,
    linkedinUrl: updated.linkedinUrl,
    githubUrl: updated.githubUrl,
    twitterUrl: updated.twitterUrl,
    avatarUrl: updated.avatarUrl,
  };
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