import type { Entry, Section, SectionType } from './resume.js';
import { DEFAULT_SECTION_FIELDS } from './resume.js';

/**
 * Pure, framework-agnostic functions for the most common resume edits.
 * These exist so "what does adding a section mean" has one definition,
 * usable from the editor UI (for optimistic local state updates) and from
 * anywhere else that ever needs to construct/modify a Resume's sections —
 * rather than every call site re-implementing array surgery and id
 * generation by hand.
 */

export function createSection(type: Exclude<SectionType, 'custom'>, title: string, order: number): Section {
  return {
    id: crypto.randomUUID(),
    type,
    title,
    order,
    fields: DEFAULT_SECTION_FIELDS[type],
    entries: [],
  };
}

export function createCustomSection(title: string, order: number): Section {
  return { id: crypto.randomUUID(), type: 'custom', title, order, fields: [], entries: [] };
}

export function addSection(sections: Section[], section: Section): Section[] {
  return [...sections, { ...section, order: sections.length }];
}

export function removeSection(sections: Section[], sectionId: string): Section[] {
  return sections.filter((s) => s.id !== sectionId).map((s, i) => ({ ...s, order: i }));
}

export function renameSection(sections: Section[], sectionId: string, title: string): Section[] {
  return sections.map((s) => (s.id === sectionId ? { ...s, title } : s));
}

export function reorderSections(sections: Section[], orderedIds: string[]): Section[] {
  const byId = new Map(sections.map((s) => [s.id, s]));
  return orderedIds
    .map((id) => byId.get(id))
    .filter((s): s is Section => Boolean(s))
    .map((s, i) => ({ ...s, order: i }));
}

export function createEntry(): Entry {
  return { id: crypto.randomUUID(), values: {} };
}

export function addEntry(sections: Section[], sectionId: string, entry: Entry = createEntry()): Section[] {
  return sections.map((s) => (s.id === sectionId ? { ...s, entries: [...s.entries, entry] } : s));
}

export function updateEntry(
  sections: Section[],
  sectionId: string,
  entryId: string,
  values: Record<string, unknown>,
): Section[] {
  return sections.map((s) =>
    s.id === sectionId
      ? {
          ...s,
          entries: s.entries.map((e) => (e.id === entryId ? { ...e, values: { ...e.values, ...values } } : e)),
        }
      : s,
  );
}

export function removeEntry(sections: Section[], sectionId: string, entryId: string): Section[] {
  return sections.map((s) => (s.id === sectionId ? { ...s, entries: s.entries.filter((e) => e.id !== entryId) } : s));
}

/** Adds a field to a custom section's field list (built-in sections have a
 * fixed field list managed by DEFAULT_SECTION_FIELDS, not user-editable). */
export function addCustomField(
  sections: Section[],
  sectionId: string,
  field: { key: string; label: string; kind: Section['fields'][number]['kind'] },
): Section[] {
  return sections.map((s) =>
    s.id === sectionId ? { ...s, fields: [...s.fields, { ...field, required: false }] } : s,
  );
}

/**
 * Canonical merge policy for applying an AI-generated partial resume update
 * on top of an existing set of sections.
 *
 * This is the single source of truth for "how does a RESUME_UPDATE combine
 * with what's already there" — used both by the chat builder's client-side
 * preview state and by the API when persisting a chat-driven update to a
 * saved resume. Previously these lived as two independent, drifted
 * implementations: the client merged safely by section `type`, while the
 * server blindly overwrote the entire `sections` column with whatever the
 * model included in that single turn, silently discarding any earlier
 * section the model didn't re-state. That relied on the model perfectly
 * re-accumulating full state every turn, which weaker/free models routinely
 * fail to do.
 *
 * Merge rules:
 * - Only AI sections with at least one entry are considered — an empty
 *   section from the model is treated as "nothing to contribute yet," not
 *   as an instruction to clear the existing section.
 * - A matching `type` in `existing` is replaced by the incoming section.
 * - A `type` present in `updates` but not in `existing` is appended.
 * - Anything already in `existing` that the update doesn't mention is left
 *   untouched — this is the piece the old server-side code got wrong.
 */
export function mergeResumeSections(existing: Section[], updates: Section[] | undefined | null): Section[] {
  if (!updates?.length) return existing;

  const incomingByType = new Map(
    updates.filter((s): s is Section => Boolean(s) && (s.entries?.length ?? 0) > 0).map((s) => [s.type, s]),
  );
  if (incomingByType.size === 0) return existing;

  const merged = existing.map((s) => incomingByType.get(s.type) ?? s);

  const existingTypes = new Set(existing.map((s) => s.type));
  for (const s of updates) {
    if (s && (s.entries?.length ?? 0) > 0 && !existingTypes.has(s.type)) {
      merged.push(s);
    }
  }

  return merged;
}
