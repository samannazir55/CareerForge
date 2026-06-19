import type { Section, ResumeTheme } from './resume.js';
import { DEFAULT_SECTION_FIELDS, DEFAULT_THEME } from './resume.js';

// Deliberately using the global `crypto.randomUUID()` (available natively in
// both Node 19+ and every modern browser) rather than importing `randomUUID`
// from 'node:crypto' — this package is bundled into the browser frontend as
// well as the API, and a Node built-in import would break that build even
// though only the API ever actually calls runMigrations() at runtime.

/**
 * ============================================================================
 * EXPLICIT SCHEMA MIGRATION FRAMEWORK
 * ============================================================================
 * Per requirement: future schema changes are handled through migration
 * functions registered here, never through ad-hoc transformations scattered
 * at call sites. Nothing reads or writes `sections`/`theme` from storage
 * without going through `runMigrations` first.
 *
 * CURRENT_SCHEMA_VERSION is the shape this whole package currently exports
 * (resume.ts's `Section`/`ResumeTheme` types, as of right now). Bumping it is
 * a two-step act of discipline: (1) write a migration in MIGRATIONS that
 * takes the previous version's payload to the new one, (2) only then change
 * resume.ts's types to the new shape. Skipping step 1 is exactly the
 * "ad-hoc transformation" this framework exists to prevent.
 *
 * Migrations are assumed to form a single linear chain — each version has at
 * most one migration moving it to the next version. That's a deliberate
 * simplification or this phase; if a future need for branching/optional
 * migrations arises, this runner is the one place that assumption would need
 * to change.
 * ============================================================================
 */

export const CURRENT_SCHEMA_VERSION = 1;

/** The part of a resume that's actually subject to schema evolution. id /
 * ownerId / timestamps are stable record metadata, never migrated. */
export interface VersionedResumePayload {
  title: string;
  theme: ResumeTheme;
  sections: Section[];
}

export interface MigratableRecord {
  schemaVersion: number;
  migrationVersion: number;
  payload: unknown;
}

export interface SchemaMigration {
  fromVersion: number;
  toVersion: number;
  description: string;
  /** Takes whatever shape `fromVersion` actually is (deliberately `unknown`
   * in this signature — each migration function internally asserts/casts to
   * the specific legacy shape it knows how to read) and returns the next
   * version's payload shape. */
  migrate: (payload: unknown) => unknown;
}

/**
 * --- Legacy shape (schemaVersion 0) -----------------------------------------
 * This is NOT part of the current contract — it's the flat shape the old
 * FastAPI app's `CV.data` used (full_name, job_title, experience/education as
 * raw strings, etc.), kept here only so the 0→1 migration below has a typed
 * description of what it's reading. New data is never created at version 0;
 * it only ever appears via the one-time legacy-resume import path described
 * in the migration plan (Section 8.3).
 */
interface LegacyV0Payload {
  full_name?: string;
  job_title?: string;
  summary?: string;
  skills?: string[];
  certifications?: string[];
  languages?: string[];
  experience?: string; // free text, "\n"-separated entries
  education?: string; // free text, "\n"-separated entries
}

function legacyTextBlockToEntries(
  block: string | undefined,
  fieldKeys: { primary: string; secondary?: string },
): Array<{ id: string; values: Record<string, unknown> }> {
  if (!block || !block.trim()) return [];
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      id: crypto.randomUUID(),
      values: {
        [fieldKeys.primary]: line,
        ...(fieldKeys.secondary ? { [fieldKeys.secondary]: '' } : {}),
        migratedFromLegacy: true,
      },
    }));
}

const migrationV0toV1: SchemaMigration = {
  fromVersion: 0,
  toVersion: 1,
  description:
    'Legacy FastAPI flat-string CV import → structured Section/Entry model. ' +
    'experience/education strings are split on newlines into one entry per ' +
    'line, tagged migratedFromLegacy so the UI can prompt the user to ' +
    'review/re-split them rather than silently dropping data.',
  migrate(raw: unknown): VersionedResumePayload {
    const legacy = raw as LegacyV0Payload;

    const sections: Section[] = [
      {
        id: crypto.randomUUID(),
        type: 'summary',
        title: 'Summary',
        order: 0,
        fields: DEFAULT_SECTION_FIELDS.summary,
        entries: legacy.summary ? [{ id: crypto.randomUUID(), values: { text: legacy.summary } }] : [],
      },
      {
        id: crypto.randomUUID(),
        type: 'experience',
        title: 'Experience',
        order: 1,
        fields: DEFAULT_SECTION_FIELDS.experience,
        entries: legacyTextBlockToEntries(legacy.experience, { primary: 'description', secondary: 'title' }),
      },
      {
        id: crypto.randomUUID(),
        type: 'education',
        title: 'Education',
        order: 2,
        fields: DEFAULT_SECTION_FIELDS.education,
        entries: legacyTextBlockToEntries(legacy.education, { primary: 'degree' }),
      },
      {
        id: crypto.randomUUID(),
        type: 'skills',
        title: 'Skills',
        order: 3,
        fields: DEFAULT_SECTION_FIELDS.skills,
        entries: (legacy.skills ?? []).map((name) => ({ id: crypto.randomUUID(), values: { name } })),
      },
    ];

    if (legacy.certifications?.length) {
      sections.push({
        id: crypto.randomUUID(),
        type: 'certifications',
        title: 'Certifications',
        order: 4,
        fields: DEFAULT_SECTION_FIELDS.certifications,
        entries: legacy.certifications.map((name) => ({ id: crypto.randomUUID(), values: { name } })),
      });
    }
    if (legacy.languages?.length) {
      sections.push({
        id: crypto.randomUUID(),
        type: 'languages',
        title: 'Languages',
        order: 5,
        fields: DEFAULT_SECTION_FIELDS.languages,
        entries: legacy.languages.map((name) => ({ id: crypto.randomUUID(), values: { name } })),
      });
    }

    return {
      title: legacy.job_title ? `${legacy.job_title} Resume` : 'Imported Resume',
      theme: DEFAULT_THEME,
      sections,
    };
  },
};

/** The migration registry. Add new entries here — and only here — when
 * CURRENT_SCHEMA_VERSION advances. */
export const MIGRATIONS: SchemaMigration[] = [migrationV0toV1];

export function needsMigration(schemaVersion: number): boolean {
  return schemaVersion < CURRENT_SCHEMA_VERSION;
}

/**
 * Walks the migration chain from `record.schemaVersion` to
 * CURRENT_SCHEMA_VERSION, applying each step's migrate() function in order.
 * Throws rather than silently passing through if a record's version has no
 * migration path forward — a missing migration is a deployment bug and
 * should fail loudly, not produce a half-migrated resume.
 */
export function runMigrations(record: MigratableRecord): {
  payload: VersionedResumePayload;
  schemaVersion: number;
  migrationVersion: number;
  wasMigrated: boolean;
} {
  let currentVersion = record.schemaVersion;
  let payload: unknown = record.payload;
  let migrationVersion = record.migrationVersion;
  let wasMigrated = false;

  while (currentVersion < CURRENT_SCHEMA_VERSION) {
    const migration = MIGRATIONS.find((m) => m.fromVersion === currentVersion);
    if (!migration) {
      throw new Error(
        `No migration registered from schemaVersion ${currentVersion} toward ${CURRENT_SCHEMA_VERSION}. ` +
          `This is a deployment bug — add the missing migration to MIGRATIONS before this record can be read.`,
      );
    }
    payload = migration.migrate(payload);
    currentVersion = migration.toVersion;
    migrationVersion += 1;
    wasMigrated = true;
  }

  return {
    payload: payload as VersionedResumePayload,
    schemaVersion: currentVersion,
    migrationVersion,
    wasMigrated,
  };
}
