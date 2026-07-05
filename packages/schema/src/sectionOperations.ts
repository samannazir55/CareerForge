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
// Loose enough to accept any RFC-4122-shaped id (any version/variant nibble)
// rather than only exactly what crypto.randomUUID() produces — the goal
// here is "would this pass SectionSchema/EntrySchema's z.string().uuid()
// check," not "is this exactly how we'd generate one ourselves." Being
// lenient about what already counts as valid is safe: the only consequence
// of being too strict would be needlessly regenerating an id that was
// already fine, which has no effect on correctness since sections are
// merged by `type`, not by matching entry ids across turns (see below).
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Replaces any section/entry id that doesn't look like a real UUID with a
 * freshly generated one — deterministically, in code, rather than trusting
 * the model to have generated a valid one itself. The prompt instructs the
 * model to invent a `"<uuid>"` for every id it introduces, but there's no
 * way to make a text-completion model reliably produce a correctly-shaped
 * UUID through instructions alone; this makes id correctness a property of
 * the merge step instead of a property of the model's output.
 *
 * Regenerating an id here is always safe: entries are never matched across
 * turns by id (mergeResumeSections replaces whole sections by `type`), so
 * there's no stability requirement on entry ids beyond "valid within this
 * merge," and section ids only need to be valid, not stable, for the same
 * reason.
 */
/**
 * Every mutation here goes through the pure helpers in this file rather
 * than hand-rolled array surgery in the AI-merge and editor UI call sites,
 * so "what does adding an entry mean" has exactly one definition.
 *
 * Both id and fields normalization happen here, for the same underlying
 * reason: the model authors an entire section (fields + matching entries)
 * from scratch for every new section it introduces, and there's no way to
 * make a text-completion model reliably keep two separate parts of a
 * nested JSON structure self-consistent through instructions alone. Rather
 * than trust that self-consistency, both pieces are replaced with our own
 * deterministic, known-good definitions wherever one exists.
 */
function normalizeAiSections(sections: Section[]): Section[] {
  return sections.map((s) => {
    // EntryCard/FieldInput render one input per declared field, keyed by
    // `entry.values[field.key]` — they don't inspect what's actually in
    // `values` at all. If the model's self-authored `fields` array uses
    // different key names than it happened to use in `values` (e.g.
    // declaring `company` but storing under `employer`), that data is
    // silently invisible: present in the saved resume, but with no input
    // rendered for it anywhere in the editor. DEFAULT_SECTION_FIELDS is the
    // same canonical field set createSection() uses, and the same key
    // names described in the AI prompt's schema — using it here instead of
    // whatever the model produced guarantees the rendered fields always
    // line up with real data for every standard section type. 'custom'
    // sections have no canonical definition, so the model/user-provided
    // fields are the only option there and are left as-is.
    const canonicalFields = s.type === 'custom' ? s.fields : DEFAULT_SECTION_FIELDS[s.type];
    return {
      ...s,
      id: UUID_SHAPE.test(s.id) ? s.id : crypto.randomUUID(),
      fields: canonicalFields,
      entries: s.entries.map((e) => ({
        ...e,
        id: UUID_SHAPE.test(e.id) ? e.id : crypto.randomUUID(),
      })),
    };
  });
}

export function mergeResumeSections(existing: Section[], updates: Section[] | undefined | null): Section[] {
  if (!updates?.length) return existing;

  const normalizedUpdates = normalizeAiSections(updates);

  const incomingByType = new Map(
    normalizedUpdates.filter((s): s is Section => Boolean(s) && (s.entries?.length ?? 0) > 0).map((s) => [s.type, s]),
  );
  if (incomingByType.size === 0) return existing;

  const merged = existing.map((s) => incomingByType.get(s.type) ?? s);

  const existingTypes = new Set(existing.map((s) => s.type));
  for (const s of normalizedUpdates) {
    if (s && (s.entries?.length ?? 0) > 0 && !existingTypes.has(s.type)) {
      merged.push(s);
    }
  }

  return merged;
}
