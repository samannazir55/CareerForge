import type { Resume, Section, Entry, FieldDef } from '@careerforge/schema';

// ---------------------------------------------------------------------------
// Shared helpers used by every template renderer.
// These are pure functions — no side effects, no I/O.
// ---------------------------------------------------------------------------

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Converts a plain string with newlines to HTML paragraphs. Used for
 * richtext fields which are stored as plain text with \n line breaks. */
export function richTextToHtml(text: string): string {
  if (!text) return '';
  return text
    .split('\n')
    .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : ''))
    .filter(Boolean)
    .join('');
}

/** Formats a month-input value (YYYY-MM) to a human-readable string.
 * Returns '' for anything that isn't a real yyyy-MM value — a genuine
 * 4-digit year (not "0000") and a valid month (01–12) — rather than
 * silently rendering a malformed/placeholder value as a wrong date
 * (new Date(0, 0) resolves to Jan 1900, which is worse than blank). */
export function formatDate(value: string | undefined): string {
  if (!value) return '';
  const match = value.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match || match[1] === '0000') return '';
  const date = new Date(parseInt(match[1]), parseInt(match[2]) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function formatDateRange(start: unknown, end: unknown): string {
  const s = formatDate(String(start ?? ''));
  const e = formatDate(String(end ?? ''));
  if (s && e) return `${s} – ${e}`;
  if (s) return `${s} – Present`;
  if (e) return e;
  return '';
}

export function getString(entry: Entry, key: string): string {
  const val = entry.values[key];
  return typeof val === 'string' ? val : '';
}

export function getList(entry: Entry, key: string): string[] {
  const val = entry.values[key];
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  if (typeof val === 'string') return val.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
}

/** Finds the personal-info entry (first entry of the summary section, or a
 * top-level header field). Used by templates to get name/contact/title. */
export function getPersonalInfo(resume: Resume): {
  fullName: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
} {
  // Personal info is stored as fields directly on the resume title-level
  // plus the first entry in a dedicated 'summary' section for contact fields.
  // Convention: first section of type 'summary', first entry.
  const summarySection = resume.sections.find((s) => s.type === 'summary');
  const entry = summarySection?.entries[0];
  return {
    fullName: resume.title,
    // firstName/lastName are newer, independently-stored fields (see
    // DEFAULT_SECTION_FIELDS.summary) so templates can style each part
    // differently. A resume saved before these existed simply won't have
    // them set — callers that want a two-part name should check both are
    // non-empty before using them, and fall back to `fullName` otherwise
    // (see modern.ts/classic.ts's header rendering for that fallback).
    firstName: entry ? getString({ id: '', values: entry.values }, 'firstName') : '',
    lastName: entry ? getString({ id: '', values: entry.values }, 'lastName') : '',
    jobTitle: entry ? getString({ id: '', values: entry.values }, 'jobTitle') : '',
    email: entry ? getString({ id: '', values: entry.values }, 'email') : '',
    phone: entry ? getString({ id: '', values: entry.values }, 'phone') : '',
    location: entry ? getString({ id: '', values: entry.values }, 'location') : '',
    linkedin: entry ? getString({ id: '', values: entry.values }, 'linkedin') : '',
    website: entry ? getString({ id: '', values: entry.values }, 'website') : '',
  };
}

/**
 * Extracts the free-text professional-summary paragraph from the summary
 * section's first entry, if present. This is deliberately separate from
 * getPersonalInfo (which only pulls contact fields — jobTitle/email/phone/
 * etc. — from the same entry) and from getBodySections (which excludes
 * 'summary' sections from the generic per-section render loop entirely,
 * since the section's *other* fields are personal info, not something that
 * gets its own "Summary" heading). Without this, the `text` value the AI
 * (or a user) sets on the summary entry had no rendering path at all in
 * either template — present in the saved resume, entirely invisible in
 * every export and preview.
 */
export function getSummaryText(resume: Resume): string {
  const summarySection = resume.sections.find((s) => s.type === 'summary');
  const entry = summarySection?.entries[0];
  return entry ? getString({ id: '', values: entry.values }, 'text') : '';
}

/** Renders every field of an entry generically. Used for custom sections and
 * as a fallback for any field kind a template doesn't have a special case for.
 * This is what makes "templates automatically render custom sections" true —
 * templates call this for custom/unknown sections and every field just works. */
export function renderEntryFieldsGeneric(sectionId: string, entry: Entry, fields: FieldDef[]): string {
  return fields
    .map((field) => {
      const val = entry.values[field.key];
      if (val === undefined || val === null || val === '') return '';
      if (field.kind === 'list') {
        const items = getList(entry, field.key);
        if (!items.length) return '';
        return `<div class="cf-field"><span class="cf-field-label">${escapeHtml(field.label)}:</span> ${escapeHtml(items.join(', '))}</div>`;
      }
      if (field.kind === 'richtext') {
        return `<div class="cf-field cf-field--richtext"><span class="cf-field-label">${escapeHtml(field.label)}</span>${cfField(sectionId, entry.id, field.key, richTextToHtml(String(val)))}</div>`;
      }
      if (field.kind === 'url') {
        return `<div class="cf-field"><span class="cf-field-label">${escapeHtml(field.label)}:</span> ${cfField(sectionId, entry.id, field.key, `<a href="${escapeHtml(String(val))}">${escapeHtml(String(val))}</a>`)}</div>`;
      }
      if (field.kind === 'date') {
        return `<div class="cf-field"><span class="cf-field-label">${escapeHtml(field.label)}:</span> ${escapeHtml(String(val))}</div>`;
      }
      return `<div class="cf-field"><span class="cf-field-label">${escapeHtml(field.label)}:</span> ${cfField(sectionId, entry.id, field.key, escapeHtml(String(val)))}</div>`;
    })
    .filter(Boolean)
    .join('');
}

/** Returns sections in display order, excluding summary (rendered separately
 * as the header block) since every template treats it specially. */
export function getBodySections(resume: Resume): Section[] {
  return resume.sections
    .filter((s) => s.type !== 'summary')
    .sort((a, b) => a.order - b.order);
}

// ---------------------------------------------------------------------------
// Inline-preview editing hooks ("Canva-style" click-to-edit/delete)
//
// These wrap rendered fragments with data-cf-* attributes that are 100%
// inert in every normal context (PDF export, DOCX export, the read-only
// AI-chat preview) — nothing reads them unless the interactive bootstrap
// script is injected, which only happens server-side for the resume
// editor's live preview (see
// apps/api/src/domain/resume/previewInteractivity.ts and the
// `interactive` flag on POST /resumes/preview-render). Keeping the
// attributes unconditional here (rather than templates having two render
// paths) means every template — including every existing and future
// AI-generated dynamic template — gets inline editing for free.
//
// Only text / richtext / url fields get wrapped as directly editable;
// `date` and `list` fields are deliberately left unwrapped (no click
// affordance) since editing a formatted date range or a comma-joined tag
// list in place doesn't map back to structured data cleanly — those stay
// left-panel-only for now.
// ---------------------------------------------------------------------------

/** Marks a field's rendered HTML as click-to-edit. `html` may itself
 * contain markup (e.g. richtext's <p> tags) — the whole thing becomes one
 * contentEditable region. */
export function cfField(sectionId: string, entryId: string, fieldKey: string, html: string): string {
  return `<span data-cf-section="${escapeHtml(sectionId)}" data-cf-entry="${escapeHtml(entryId)}" data-cf-field="${escapeHtml(fieldKey)}">${html}</span>`;
}

/** Wraps a whole entry (one job, one degree, one project, ...) so hovering
 * it in the preview surfaces a delete control. `tag` lets callers keep
 * using the same element type/class the template already had. */
export function cfEntry(sectionId: string, entryId: string, innerHtml: string, className: string): string {
  return `<div class="${className}" data-cf-section="${escapeHtml(sectionId)}" data-cf-entry-wrap="${escapeHtml(entryId)}">${innerHtml}</div>`;
}

/** Wraps a section's heading so hovering it surfaces a "delete section"
 * control, distinct from deleting an individual entry within it. */
export function cfSectionTitle(sectionId: string, titleHtml: string, className = 'cf-section-title'): string {
  return `<div class="${className}" data-cf-section-title="${escapeHtml(sectionId)}">${titleHtml}</div>`;
}

/** The summary section's id + first-entry id, if one exists — needed so
 * the header block (name/jobTitle/email/phone/... which all live in that
 * entry, see getPersonalInfo) can be wrapped with the right
 * data-cf-section/data-cf-entry pair for inline editing. Returns null for
 * a resume with no summary section yet (nothing to address). */
export function getSummaryRef(resume: Resume): { sectionId: string; entryId: string } | null {
  const summarySection = resume.sections.find((s) => s.type === 'summary');
  const entry = summarySection?.entries[0];
  if (!summarySection || !entry) return null;
  return { sectionId: summarySection.id, entryId: entry.id };
}

/** Sentinel used for the resume's title (full name) field, which — unlike
 * every other editable field — isn't stored in any section/entry at all
 * (it's the top-level Resume.title). The preview's postMessage handler
 * special-cases this sectionId to call the title setter instead of
 * updateEntry(). */
export const CF_TITLE_SECTION_ID = '__title__';
export const CF_TITLE_ENTRY_ID = '__title__';
export const CF_TITLE_FIELD_KEY = 'title';