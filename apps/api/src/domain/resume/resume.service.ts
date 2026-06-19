import type { Resume as ResumeRow, ResumeVersion as ResumeVersionRow } from '@prisma/client';
import {
  CURRENT_SCHEMA_VERSION,
  buildDefaultSections,
  runMigrations,
  DEFAULT_THEME,
  type Resume,
  type ResumeSummary,
  type ResumeTheme,
  type ResumeVersion,
  type ResumeVersionSummary,
  type Section,
} from '@careerforge/schema';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../lib/errors.js';
import { diffSections } from './diff.js';

// --- Mapping helpers: DB row (JSON columns, untyped) <-> shared Resume type ----

function toPublicResume(row: ResumeRow): Resume {
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    theme: row.theme as ResumeTheme,
    sections: row.sections as Section[],
    schemaVersion: row.schemaVersion,
    migrationVersion: row.migrationVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSummary(row: ResumeRow): ResumeSummary {
  return {
    id: row.id,
    title: row.title,
    templateId: (row.theme as ResumeTheme).templateId,
    updatedAt: row.updatedAt.toISOString(),
    schemaVersion: row.schemaVersion,
  };
}

function toPublicVersion(row: ResumeVersionRow): ResumeVersion {
  return {
    id: row.id,
    resumeId: row.resumeId,
    title: row.title,
    theme: row.theme as ResumeTheme,
    sections: row.sections as Section[],
    schemaVersion: row.schemaVersion,
    migrationVersion: row.migrationVersion,
    label: row.label,
    createdAt: row.createdAt.toISOString(),
  };
}

function toVersionSummary(row: ResumeVersionRow): ResumeVersionSummary {
  return { id: row.id, label: row.label, createdAt: row.createdAt.toISOString(), schemaVersion: row.schemaVersion };
}

/**
 * Runs the resume through the migration framework if needed and, if it WAS
 * migrated, writes the migrated result straight back to the row so future
 * reads skip the migration work — the standard lazy/on-read migration
 * pattern. Never mutates a ResumeVersion row this way (see migrateVersion
 * below) — historical snapshots stay exactly as they were saved.
 */
async function migrateAndPersistIfNeeded(row: ResumeRow): Promise<ResumeRow> {
  if (row.schemaVersion >= CURRENT_SCHEMA_VERSION) return row;

  const result = runMigrations({
    schemaVersion: row.schemaVersion,
    migrationVersion: row.migrationVersion,
    payload: { title: row.title, theme: row.theme, sections: row.sections },
  });

  if (!result.wasMigrated) return row;

  return prisma.resume.update({
    where: { id: row.id },
    data: {
      title: result.payload.title,
      theme: result.payload.theme,
      sections: result.payload.sections,
      schemaVersion: result.schemaVersion,
      migrationVersion: result.migrationVersion,
    },
  });
}

/** Same migration logic, but for an immutable version snapshot: returns the
 * migrated payload in memory without writing anything back to the DB. */
function migrateVersionInMemory(row: ResumeVersionRow): { theme: ResumeTheme; sections: Section[]; title: string } {
  if (row.schemaVersion >= CURRENT_SCHEMA_VERSION) {
    return { title: row.title, theme: row.theme as ResumeTheme, sections: row.sections as Section[] };
  }
  const result = runMigrations({
    schemaVersion: row.schemaVersion,
    migrationVersion: row.migrationVersion,
    payload: { title: row.title, theme: row.theme, sections: row.sections },
  });
  return result.payload;
}

async function findOwnedResumeOrThrow(id: string, ownerId: string): Promise<ResumeRow> {
  const row = await prisma.resume.findFirst({ where: { id, ownerId } });
  // 404, not 403, for both "doesn't exist" and "exists but isn't yours" —
  // deliberately doesn't reveal which case it is.
  if (!row) throw new NotFoundError('Resume not found.', 'RESUME_NOT_FOUND');
  return row;
}

// --- Public service API -------------------------------------------------------

export async function createResume(ownerId: string, title: string): Promise<Resume> {
  const row = await prisma.resume.create({
    data: {
      ownerId,
      title,
      theme: DEFAULT_THEME,
      sections: buildDefaultSections(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      migrationVersion: CURRENT_SCHEMA_VERSION,
    },
  });
  return toPublicResume(row);
}

export async function listResumes(ownerId: string): Promise<ResumeSummary[]> {
  const rows = await prisma.resume.findMany({ where: { ownerId }, orderBy: { updatedAt: 'desc' } });
  return rows.map(toSummary);
}

export async function getResume(id: string, ownerId: string): Promise<Resume> {
  const row = await findOwnedResumeOrThrow(id, ownerId);
  const migrated = await migrateAndPersistIfNeeded(row);
  return toPublicResume(migrated);
}

export async function updateResume(
  id: string,
  ownerId: string,
  patch: { title?: string; theme?: ResumeTheme; sections?: Section[] },
): Promise<Resume> {
  await findOwnedResumeOrThrow(id, ownerId); // authorization check before writing
  const row = await prisma.resume.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.theme !== undefined ? { theme: patch.theme } : {}),
      ...(patch.sections !== undefined ? { sections: patch.sections } : {}),
    },
  });
  return toPublicResume(row);
}

export async function deleteResume(id: string, ownerId: string): Promise<void> {
  await findOwnedResumeOrThrow(id, ownerId);
  await prisma.resume.delete({ where: { id } });
}

// --- Version history -----------------------------------------------------------

export async function createVersion(id: string, ownerId: string, label?: string): Promise<ResumeVersion> {
  const row = await findOwnedResumeOrThrow(id, ownerId);
  const migrated = await migrateAndPersistIfNeeded(row);

  const version = await prisma.resumeVersion.create({
    data: {
      resumeId: migrated.id,
      title: migrated.title,
      theme: migrated.theme as object,
      sections: migrated.sections as object,
      schemaVersion: migrated.schemaVersion,
      migrationVersion: migrated.migrationVersion,
      label: label ?? null,
    },
  });
  return toPublicVersion(version);
}

export async function listVersions(resumeId: string, ownerId: string): Promise<ResumeVersionSummary[]> {
  await findOwnedResumeOrThrow(resumeId, ownerId);
  const rows = await prisma.resumeVersion.findMany({ where: { resumeId }, orderBy: { createdAt: 'desc' } });
  return rows.map(toVersionSummary);
}

async function findOwnedVersionOrThrow(resumeId: string, versionId: string, ownerId: string): Promise<ResumeVersionRow> {
  await findOwnedResumeOrThrow(resumeId, ownerId);
  const row = await prisma.resumeVersion.findFirst({ where: { id: versionId, resumeId } });
  if (!row) throw new NotFoundError('Resume version not found.', 'RESUME_VERSION_NOT_FOUND');
  return row;
}

export async function getVersion(resumeId: string, versionId: string, ownerId: string): Promise<ResumeVersion> {
  const row = await findOwnedVersionOrThrow(resumeId, versionId, ownerId);
  return toPublicVersion(row);
}

/**
 * Restoring is never destructive: the target version's content (migrated to
 * the current schema in memory) becomes the resume's new live state, AND
 * that act itself is recorded as a brand-new version — so "restore" is just
 * "create a new version equal to an old one," never an edit-in-place that
 * could lose whatever the live state was right before the restore.
 */
export async function restoreVersion(resumeId: string, versionId: string, ownerId: string): Promise<Resume> {
  const versionRow = await findOwnedVersionOrThrow(resumeId, versionId, ownerId);
  const migratedPayload = migrateVersionInMemory(versionRow);

  // Snapshot current live state before overwriting it, so the moment right
  // before the restore is itself recoverable.
  await createVersion(resumeId, ownerId, 'Before restore');

  const updated = await prisma.resume.update({
    where: { id: resumeId },
    data: {
      title: migratedPayload.title,
      theme: migratedPayload.theme as object,
      sections: migratedPayload.sections as object,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      migrationVersion: CURRENT_SCHEMA_VERSION,
    },
  });

  await createVersion(resumeId, ownerId, `Restored from ${versionRow.createdAt.toISOString()}`);

  return toPublicResume(updated);
}

export async function compareVersions(resumeId: string, versionAId: string, versionBId: string, ownerId: string) {
  const [a, b] = await Promise.all([
    findOwnedVersionOrThrow(resumeId, versionAId, ownerId),
    findOwnedVersionOrThrow(resumeId, versionBId, ownerId),
  ]);
  const migratedA = migrateVersionInMemory(a);
  const migratedB = migrateVersionInMemory(b);
  return diffSections(migratedA.sections, migratedB.sections);
}
