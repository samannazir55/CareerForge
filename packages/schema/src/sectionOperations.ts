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
