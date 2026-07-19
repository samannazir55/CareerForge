import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../lib/errors.js';
import { sanitise } from '../../lib/sanitise.js';
import type {
  CreateJobApplicationRequest,
  UpdateJobApplicationRequest,
  JobApplicationStatus,
  JobApplication,
} from '@careerforge/schema';
import type { JobApplication as PrismaJobApplication } from '@prisma/client';

/** Maps the Prisma row (DB column names) to the tracker's wire shape. */
function serialize(row: PrismaJobApplication): JobApplication {
  return {
    id: row.id,
    companyName: row.company,
    jobTitle: row.role,
    jobUrl: row.url,
    status: row.status,
    notes: row.notes,
    appliedAt: row.appliedAt ? row.appliedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Lists the authenticated user's job applications, optionally filtered by
 * status. Most recently created first.
 */
export async function listJobApplications(
  userId: string,
  status?: JobApplicationStatus,
): Promise<JobApplication[]> {
  const rows = await prisma.jobApplication.findMany({
    where: { userId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serialize);
}

/** Creates a new job application owned by the given user. */
export async function createJobApplication(
  userId: string,
  input: CreateJobApplicationRequest,
): Promise<JobApplication> {
  const row = await prisma.jobApplication.create({
    data: {
      userId,
      company: input.companyName,
      role: input.jobTitle,
      url: input.jobUrl,
      status: input.status,
      notes: input.notes !== undefined ? sanitise(input.notes, 10_000) : input.notes,
      appliedAt: input.appliedAt ? new Date(input.appliedAt) : undefined,
    },
  });
  return serialize(row);
}

/**
 * Fetches a single application, scoped to its owner. Throws NotFoundError
 * if it doesn't exist or belongs to a different user — callers never learn
 * which, so IDs can't be used to probe for other users' data.
 */
async function findOwned(userId: string, id: string): Promise<PrismaJobApplication> {
  const row = await prisma.jobApplication.findFirst({ where: { id, userId } });
  if (!row) throw new NotFoundError('Job application not found.', 'JOB_APPLICATION_NOT_FOUND');
  return row;
}

/** Updates any subset of fields on a job application owned by the user. */
export async function updateJobApplication(
  userId: string,
  id: string,
  input: UpdateJobApplicationRequest,
): Promise<JobApplication> {
  await findOwned(userId, id);

  const row = await prisma.jobApplication.update({
    where: { id },
    data: {
      ...(input.companyName !== undefined ? { company: input.companyName } : {}),
      ...(input.jobTitle !== undefined ? { role: input.jobTitle } : {}),
      ...(input.jobUrl !== undefined ? { url: input.jobUrl } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes === null ? null : sanitise(input.notes, 10_000) } : {}),
      ...(input.appliedAt !== undefined
        ? { appliedAt: input.appliedAt ? new Date(input.appliedAt) : null }
        : {}),
    },
  });
  return serialize(row);
}

/** Deletes a job application owned by the user. */
export async function deleteJobApplication(userId: string, id: string): Promise<void> {
  await findOwned(userId, id);
  await prisma.jobApplication.delete({ where: { id } });
}
