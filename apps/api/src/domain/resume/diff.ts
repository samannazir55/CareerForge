import type { Section, ResumeVersionDiff, SectionDiff, SectionDiffEntry } from '@careerforge/schema';

/**
 * Diffs two section lists by id, not by array position — so a section the
 * user merely reordered doesn't show up as "removed and re-added," and a
 * genuinely new/deleted section is distinguishable from one that just moved.
 */
export function diffSections(before: Section[], after: Section[]): ResumeVersionDiff {
  const beforeById = new Map(before.map((s) => [s.id, s]));
  const afterById = new Map(after.map((s) => [s.id, s]));
  const allIds = new Set([...beforeById.keys(), ...afterById.keys()]);

  const sections: SectionDiff[] = [...allIds].map((sectionId) => {
    const b = beforeById.get(sectionId);
    const a = afterById.get(sectionId);

    if (!b && a) return { sectionId, title: a.title, status: 'added', entries: diffEntries([], a.entries) };
    if (b && !a) return { sectionId, title: b.title, status: 'removed', entries: diffEntries(b.entries, []) };
    if (b && a) {
      const entries = diffEntries(b.entries, a.entries);
      const status = entries.some((e) => e.status !== 'unchanged') || b.title !== a.title ? 'changed' : 'unchanged';
      return { sectionId, title: a.title, status, entries };
    }
    // Unreachable: sectionId came from one of the two maps' keys.
    throw new Error('Unreachable section diff state');
  });

  return { sections };
}

function diffEntries(
  before: Array<{ id: string; values: Record<string, unknown> }>,
  after: Array<{ id: string; values: Record<string, unknown> }>,
): SectionDiffEntry[] {
  const beforeById = new Map(before.map((e) => [e.id, e]));
  const afterById = new Map(after.map((e) => [e.id, e]));
  const allIds = new Set([...beforeById.keys(), ...afterById.keys()]);

  return [...allIds].map((entryId) => {
    const b = beforeById.get(entryId) ?? null;
    const a = afterById.get(entryId) ?? null;

    if (!b && a) return { entryId, status: 'added', before: null, after: a.values, changedFields: Object.keys(a.values) };
    if (b && !a) return { entryId, status: 'removed', before: b.values, after: null, changedFields: Object.keys(b.values) };
    if (b && a) {
      const keys = new Set([...Object.keys(b.values), ...Object.keys(a.values)]);
      const changedFields = [...keys].filter((k) => JSON.stringify(b.values[k]) !== JSON.stringify(a.values[k]));
      return {
        entryId,
        status: changedFields.length > 0 ? 'changed' : 'unchanged',
        before: b.values,
        after: a.values,
        changedFields,
      };
    }
    throw new Error('Unreachable entry diff state');
  });
}
