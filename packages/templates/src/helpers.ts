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
 * Returns the raw value unchanged if it doesn't match the expected format. */
export function formatDate(value: string | undefined): string {
  if (!value) return '';
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return value;
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
    jobTitle: entry ? getString({ id: '', values: entry.values }, 'jobTitle') : '',
    email: entry ? getString({ id: '', values: entry.values }, 'email') : '',
    phone: entry ? getString({ id: '', values: entry.values }, 'phone') : '',
    location: entry ? getString({ id: '', values: entry.values }, 'location') : '',
    linkedin: entry ? getString({ id: '', values: entry.values }, 'linkedin') : '',
    website: entry ? getString({ id: '', values: entry.values }, 'website') : '',
  };
}

/** Renders every field of an entry generically. Used for custom sections and
 * as a fallback for any field kind a template doesn't have a special case for.
 * This is what makes "templates automatically render custom sections" true —
 * templates call this for custom/unknown sections and every field just works. */
export function renderEntryFieldsGeneric(entry: Entry, fields: FieldDef[]): string {
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
        return `<div class="cf-field cf-field--richtext"><span class="cf-field-label">${escapeHtml(field.label)}</span>${richTextToHtml(String(val))}</div>`;
      }
      if (field.kind === 'url') {
        return `<div class="cf-field"><span class="cf-field-label">${escapeHtml(field.label)}:</span> <a href="${escapeHtml(String(val))}">${escapeHtml(String(val))}</a></div>`;
      }
      return `<div class="cf-field"><span class="cf-field-label">${escapeHtml(field.label)}:</span> ${escapeHtml(String(val))}</div>`;
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
