import type { Resume } from '@careerforge/schema';

// ---------------------------------------------------------------------------
// Dynamic template renderer
// ---------------------------------------------------------------------------
// Dynamic templates are HTML strings stored in the database with a simple
// placeholder syntax that this renderer fills in from a Resume object.
//
// PLACEHOLDER SYNTAX
// ──────────────────
// Scalars (replaced with escaped text):
//   {{name}}      {{jobTitle}}   {{email}}     {{phone}}
//   {{location}}  {{linkedin}}   {{website}}   {{summary}}
//   {{accentColor}}      user-chosen hex from the resume's color picker
//   {{accentColorSoft}}  a light tint of accentColor (mixed toward white,
//                        88%) — for background fills, tag backgrounds, etc.
//   {{accentColorDark}}  a darkened shade of accentColor (mixed toward
//                        black, 25%) — for hover states / higher-contrast text
//
// Loop blocks (inner template repeated per entry):
//   {{#experiences}} ... {{/experiences}}
//     inner vars: {{exp.title}}  {{exp.company}}  {{exp.location}}
//                 {{exp.dateRange}}  {{exp.description}}
//
//   {{#education}} ... {{/education}}
//     inner vars: {{edu.degree}}  {{edu.school}}  {{edu.dateRange}}
//
//   {{#skills}} ... {{/skills}}
//     inner var: {{skill.name}}
//
//   {{#certifications}} ... {{/certifications}}
//     inner vars: {{cert.name}}  {{cert.issuer}}  {{cert.date}}
//
//   {{#projects}} ... {{/projects}}
//     inner vars: {{project.name}}  {{project.description}}  {{project.url}}
//
//   {{#languages}} ... {{/languages}}
//     inner vars: {{lang.name}}  {{lang.proficiency}}
//
//   {{#references}} ... {{/references}}
//     inner vars: {{ref.name}}  {{ref.relationship}}  {{ref.contact}}
//
//   {{#customSections}} ... {{/customSections}}
//     Any section the user added beyond the built-in types above (its
//     fields are user-defined, so there's no fixed set of inner vars).
//     inner vars: {{section.title}}
//     nested loop, one row per entry in the section:
//       {{#entries}} ... {{/entries}}
//         inner var: {{entry.fields}} — every field of that entry,
//         pre-rendered as "<div>Label: value</div>" HTML (already escaped).
//
// Conditional blocks (renders inner content only when value is non-empty):
//   {{#if name}} ... {{/if name}}
// ---------------------------------------------------------------------------

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Color helpers for {{accentColorSoft}} / {{accentColorDark}} ───────────
// Templates have no CSS preprocessor available (no Sass lighten()/darken()),
// so these shades are computed once here, server-side, from the plain hex
// string the user picked in the theme's accent-color picker.
const DEFAULT_ACCENT: [number, number, number] = [79, 70, 229]; // #4f46e5

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return DEFAULT_ACCENT;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  );
}

/** Mixes `hex` toward `target` ([r,g,b]) by `amount` (0–1). */
function mixToward(hex: string, target: [number, number, number], amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([
    r + (target[0] - r) * amount,
    g + (target[1] - g) * amount,
    b + (target[2] - b) * amount,
  ]);
}

/** Replace {{key}} tokens in a snippet using a flat string map. */
function interpolate(snippet: string, vars: Record<string, string>): string {
  return snippet.replace(/\{\{([\w.]+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? vars[key] : '',
  );
}

function fmtDate(ym?: string): string {
  if (!ym) return '';
  const [year, month] = ym.split('-');
  if (!year) return '';
  if (!month) return year;
  const d = new Date(Number(year), Number(month) - 1);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function dateRange(start?: string, end?: string): string {
  const s = fmtDate(start);
  const e = end ? fmtDate(end) : 'Present';
  return s ? `${s} – ${e}` : e;
}

/**
 * Finds a balanced {{#tag}} ... {{/tag}} region in `source`, trying each
 * name in `tagNames` in order (supports aliases like 'experience' vs
 * 'experiences') and returning whichever starts earliest.
 *
 * This is depth-aware rather than a single non-greedy regex, because the
 * AI generator commonly nests the SAME tag name inside itself:
 *   {{#experiences}}
 *     <h3>Experience</h3>
 *     {{#experiences}}<div>...{{exp.title}}...</div>{{/experiences}}
 *   {{/experiences}}
 * — an outer "show this section" wrapper around an inner per-entry
 * repeater. A naive `/\{\{#tag\}\}([\s\S]*?)\{\{\/tag\}\}/` regex pairs the
 * outer open tag with the FIRST close tag it meets — the inner one — which
 * leaves the true outer close tag as unmatched literal text in the output,
 * and (because the header got captured as part of the "repeated" template)
 * duplicates the heading once per entry. That produced exactly the garbled
 * output with literal `{{#experiences}}` / `{{/experiences}}` text and
 * repeated headings.
 */
function extractBlock(
  source: string,
  tagNames: string[],
): { match: string; inner: string; index: number } | null {
  let best: { match: string; inner: string; index: number } | null = null;

  for (const tag of tagNames) {
    const openStr = `{{#${tag}}}`;
    const closeStr = `{{/${tag}}}`;
    const start = source.indexOf(openStr);
    if (start === -1) continue;
    if (best && start >= best.index) continue; // an earlier-starting alias already won

    let depth = 1;
    let i = start + openStr.length;
    let found: { match: string; inner: string; index: number } | null = null;
    while (i < source.length) {
      if (source.startsWith(openStr, i)) {
        depth++;
        i += openStr.length;
        continue;
      }
      if (source.startsWith(closeStr, i)) {
        depth--;
        i += closeStr.length;
        if (depth === 0) {
          found = {
            match: source.slice(start, i),
            inner: source.slice(start + openStr.length, i - closeStr.length),
            index: start,
          };
          break;
        }
        continue;
      }
      i++;
    }
    if (found) best = found;
    // if unbalanced (no `found`), fall through and try the next alias
  }

  return best;
}

/** Generic "loop block" replacer: finds every top-level {{#tag}} ... {{/tag}}
 * region in `source` (trying each alias in `tagNames`) and replaces it with
 * `items.map(renderItem).join('')`, or '' if items is empty.
 *
 * Handles BOTH conventions the AI generator produces:
 *  - Flat:   {{#tag}}<div>{{item.x}}</div>{{/tag}}
 *            → the whole inner content is repeated once per item.
 *  - Nested: {{#tag}}<h3>Heading</h3>{{#tag}}<div>{{item.x}}</div>{{/tag}}{{/tag}}
 *            → the heading is kept exactly once (it's outside the inner
 *              repeater), and only the inner block repeats per item.
 */
function renderLoop<T>(
  source: string,
  tagNames: string | string[],
  items: T[],
  renderItem: (tmpl: string, item: T) => string,
): string {
  const tags = Array.isArray(tagNames) ? tagNames : [tagNames];
  let out = source;

  while (true) {
    const outer = extractBlock(out, tags);
    if (!outer) break;

    const nested = extractBlock(outer.inner, tags);
    let rendered: string;
    if (!items.length) {
      rendered = '';
    } else if (nested) {
      const before = outer.inner.slice(0, nested.index);
      const after = outer.inner.slice(nested.index + nested.match.length);
      rendered = before + items.map((item) => renderItem(nested.inner, item)).join('') + after;
    } else {
      rendered = items.map((item) => renderItem(outer.inner, item)).join('');
    }

    out = out.slice(0, outer.index) + rendered + out.slice(outer.index + outer.match.length);
  }

  return out;
}

/** Renders every field of a custom-section entry generically as escaped
 * "Label: value" HTML rows — the same fallback approach code-registered
 * templates use (renderEntryFieldsGeneric in packages/templates/src/helpers)
 * for section shapes a template has no fixed layout for. */
function renderEntryFieldsAsHtml(
  entry: { values?: Record<string, unknown> },
  fields: Array<{ key: string; label: string; kind: string }>,
): string {
  const values = entry.values ?? {};
  return fields
    .map((field) => {
      const val = values[field.key];
      if (val === undefined || val === null || val === '') return '';
      if (field.kind === 'list' && Array.isArray(val)) {
        return `<div class="cf-field"><span class="cf-field-label">${escHtml(field.label)}:</span> ${escHtml(val.map(String).join(', '))}</div>`;
      }
      if (field.kind === 'richtext') {
        return `<div class="cf-field cf-field--richtext"><span class="cf-field-label">${escHtml(field.label)}</span>${String(val).replace(/\n/g, '<br>')}</div>`;
      }
      return `<div class="cf-field"><span class="cf-field-label">${escHtml(field.label)}:</span> ${escHtml(String(val))}</div>`;
    })
    .filter(Boolean)
    .join('');
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function renderDynamicTemplate(templateHtml: string, resume: Resume): string {
  // ── Personal info ─────────────────────────────────────────────────────────
  const summarySection = resume.sections.find((s) => s.type === 'summary');
  const sv = (summarySection?.entries[0]?.values ?? {}) as Record<string, string>;

  const accentColor = resume.theme?.accentColor || '#4f46e5';

  const scalars: Record<string, string> = {
    name:     escHtml(resume.title ?? ''),
    jobTitle: escHtml(sv.jobTitle ?? ''),
    email:    escHtml(sv.email    ?? ''),
    phone:    escHtml(sv.phone    ?? ''),
    location: escHtml(sv.location ?? ''),
    linkedin: escHtml(sv.linkedin ?? ''),
    website:  escHtml(sv.website  ?? ''),
    // summary text may contain basic HTML; don't double-escape it
    summary:  sv.text ?? '',
    accentColor:     accentColor,
    accentColorSoft: mixToward(accentColor, [255, 255, 255], 0.88),
    accentColorDark: mixToward(accentColor, [0, 0, 0], 0.25),
  };

  let out = templateHtml;

  // ── Scalar substitution ───────────────────────────────────────────────────
  for (const [k, v] of Object.entries(scalars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }

  // ── Conditionals  {{#if key}} ... {{/if key}} ─────────────────────────────
  out = out.replace(
    /\{\{#if ([\w.]+)\}\}([\s\S]*?)\{\{\/if \1\}\}/g,
    (_, key, inner) => (scalars[key] ? inner : ''),
  );

  // ── {{#experiences}} ... {{/experiences}} ────────────────────────────────
  const expSection = resume.sections.find((s) => s.type === 'experience');
  out = renderLoop(out, ['experiences', 'experience'], expSection?.entries ?? [], (tmpl, e) => {
    const v = (e.values ?? {}) as Record<string, string>;
    return interpolate(tmpl, {
      'exp.title':       escHtml(v.title    ?? ''),
      'exp.company':     escHtml(v.company  ?? ''),
      'exp.location':    escHtml(v.location ?? ''),
      'exp.startDate':   fmtDate(v.startDate),
      'exp.endDate':     v.endDate ? fmtDate(v.endDate) : 'Present',
      'exp.dateRange':   dateRange(v.startDate, v.endDate),
      // description may contain \n — convert to <br> for HTML output
      'exp.description': (v.description ?? '').replace(/\n/g, '<br>'),
    });
  });

  // ── {{#education}} ... {{/education}} ────────────────────────────────────
  const eduSection = resume.sections.find((s) => s.type === 'education');
  out = renderLoop(out, 'education', eduSection?.entries ?? [], (tmpl, e) => {
    const v = (e.values ?? {}) as Record<string, string>;
    return interpolate(tmpl, {
      'edu.degree':    escHtml(v.degree ?? ''),
      'edu.school':    escHtml(v.school ?? ''),
      'edu.startDate': fmtDate(v.startDate),
      'edu.endDate':   v.endDate ? fmtDate(v.endDate) : '',
      'edu.dateRange': dateRange(v.startDate, v.endDate === '' ? undefined : v.endDate),
    });
  });

  // ── {{#skills}} ... {{/skills}} ──────────────────────────────────────────
  const skillsSection = resume.sections.find((s) => s.type === 'skills');
  out = renderLoop(out, 'skills', skillsSection?.entries ?? [], (tmpl, e) => {
    const v = (e.values ?? {}) as Record<string, string>;
    return interpolate(tmpl, { 'skill.name': escHtml(v.name ?? '') });
  });

  // ── {{#certifications}} ... {{/certifications}} ──────────────────────────
  const certSection = resume.sections.find((s) => s.type === 'certifications');
  out = renderLoop(out, 'certifications', certSection?.entries ?? [], (tmpl, e) => {
    const v = (e.values ?? {}) as Record<string, string>;
    return interpolate(tmpl, {
      'cert.name':   escHtml(v.name   ?? ''),
      'cert.issuer': escHtml(v.issuer ?? ''),
      'cert.date':   fmtDate(v.date),
    });
  });

  // ── {{#projects}} ... {{/projects}} ──────────────────────────────────────
  const projectsSection = resume.sections.find((s) => s.type === 'projects');
  out = renderLoop(out, 'projects', projectsSection?.entries ?? [], (tmpl, e) => {
    const v = (e.values ?? {}) as Record<string, string>;
    return interpolate(tmpl, {
      'project.name':        escHtml(v.name ?? ''),
      'project.description': (v.description ?? '').replace(/\n/g, '<br>'),
      'project.url':         escHtml(v.url ?? ''),
    });
  });

  // ── {{#languages}} ... {{/languages}} ────────────────────────────────────
  const languagesSection = resume.sections.find((s) => s.type === 'languages');
  out = renderLoop(out, 'languages', languagesSection?.entries ?? [], (tmpl, e) => {
    const v = (e.values ?? {}) as Record<string, string>;
    return interpolate(tmpl, {
      'lang.name':        escHtml(v.name ?? ''),
      'lang.proficiency': escHtml(v.proficiency ?? ''),
    });
  });

  // ── {{#references}} ... {{/references}} ──────────────────────────────────
  const referencesSection = resume.sections.find((s) => s.type === 'references');
  out = renderLoop(out, 'references', referencesSection?.entries ?? [], (tmpl, e) => {
    const v = (e.values ?? {}) as Record<string, string>;
    return interpolate(tmpl, {
      'ref.name':         escHtml(v.name ?? ''),
      'ref.relationship': escHtml(v.relationship ?? ''),
      'ref.contact':      escHtml(v.contact ?? ''),
    });
  });

  // ── {{#customSections}} ... {{/customSections}} ─────────────────────────
  // Every section the admin's placeholder vocabulary above doesn't cover by
  // name — in practice `type: 'custom'` sections, whose fields are defined
  // per-resume by the user. Mirrors packages/templates' generic fallback:
  // a template never special-cases a custom section, it just iterates
  // whatever fields exist. Nested {{#entries}} loop renders one row per
  // entry, each already-flattened to HTML via {{entry.fields}}.
  const customSections = resume.sections.filter((s) => s.type === 'custom');
  out = renderLoop(out, 'customSections', customSections, (tmpl, section) => {
    const withTitle = tmpl.replace(/\{\{section\.title\}\}/g, escHtml(section.title ?? ''));
    return renderLoop(withTitle, 'entries', section.entries ?? [], (entryTmpl, entry) =>
      interpolate(entryTmpl, {
        'entry.fields': renderEntryFieldsAsHtml(entry, section.fields ?? []),
      }),
    );
  });

  return out;
}
