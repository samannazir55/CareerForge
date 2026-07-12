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
//   {{name}}      {{firstName}}  {{lastName}}  {{jobTitle}}
//   {{email}}     {{phone}}      {{location}}  {{linkedin}}
//   {{website}}   {{summary}}
//   {{name}} is the resume's combined display name (kept for templates
//   written before firstName/lastName existed). {{firstName}}/{{lastName}}
//   are the same person split into two parts so a template can style each
//   independently (e.g. two different colors in the header) — they may be
//   empty for resumes saved before the split existed and never opened in
//   the editor since, so a template using them should have a sensible
//   fallback to {{name}} for that case.
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

// ── Inline-preview editing hooks ("Canva-style" click-to-edit/delete) ─────
// Same idea as packages/templates/src/helpers.ts's cfField/cfEntry, applied
// at the substitution layer instead of inside each template's markup. Since
// EVERY dynamic (AI-generated) template's field values and per-entry loop
// iterations pass through this one file, wrapping them here means every
// existing and future dynamic template gets inline editing for free — no
// per-template changes needed, regardless of the arbitrary HTML/CSS layout
// each one uses.
//
// wrapEntry uses `display:contents` rather than a normal block/inline
// wrapper specifically because we don't control (or know) the surrounding
// CSS — an AI-authored template might lay entries out with flex/grid, and
// a wrapper div participating in that layout could visibly break it.
// display:contents makes the wrapper invisible to layout while remaining a
// real DOM node the bootstrap script (see previewInteractivity.ts) can
// find and measure for its hover/delete overlay.
//
// As with the code templates, only plain text/richtext/url values get
// wrapField'd — computed date/date-range strings and the section-title
// loop don't have a clean structured round-trip, so those aren't made
// directly editable here.
const CF_TITLE_SECTION_ID = '__title__';
const CF_TITLE_ENTRY_ID = '__title__';
const CF_TITLE_FIELD_KEY = 'title';

function wrapField(sectionId: string, entryId: string, fieldKey: string, html: string): string {
  return `<span data-cf-section="${escHtml(sectionId)}" data-cf-entry="${escHtml(entryId)}" data-cf-field="${escHtml(fieldKey)}">${html}</span>`;
}

function wrapEntry(sectionId: string, entryId: string, html: string): string {
  return `<div data-cf-section="${escHtml(sectionId)}" data-cf-entry-wrap="${escHtml(entryId)}" style="display:contents">${html}</div>`;
}

function wrapSectionTitle(sectionId: string, html: string): string {
  return `<span data-cf-section-title="${escHtml(sectionId)}">${html}</span>`;
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
  // Strict yyyy-MM: a real 4-digit year (not "0000") and a valid month
  // 01–12 — matches what the native month input actually accepts. Anything
  // else (a malformed/placeholder value like "0000-01" that somehow ended
  // up stored, possibly AI-invented for an "unknown" date) is treated as
  // no date at all rather than rendered as a wrong one (new Date(0, 0)
  // silently resolves to Jan 1900, which is worse than showing nothing).
  const match = ym.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match || match[1] === '0000') return '';
  const d = new Date(Number(match[1]), Number(match[2]) - 1);
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
  openPrefix: '#' | '^' = '#',
): { match: string; inner: string; index: number } | null {
  let best: { match: string; inner: string; index: number } | null = null;

  for (const tag of tagNames) {
    const openStr = `{{${openPrefix}${tag}}}`;
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
/**
 * Finds the first {{#if KEY}} ... {{/if}} (or {{/if KEY}}) block, depth-aware
 * across NESTED {{#if}} blocks of any key -- any {{/if...}} closes the
 * innermost currently-open {{#if}}, whether or not it repeats the key.
 * Deliberately lenient (see renderDynamicTemplate's conditional section for
 * why): this accepts every closing form a model actually produces, rather
 * than only the one form the system prompt originally asked for.
 * Returns null if no {{#if}} is found, or if it's unbalanced (no matching
 * close by end of string) -- an unbalanced block is left as literal text,
 * same as an unbalanced loop tag.
 */
function extractIfBlock(source: string): { key: string; match: string; inner: string; index: number } | null {
  const openMatch = source.match(/\{\{#if\s+([\w.]+)\}\}/);
  if (!openMatch || openMatch.index === undefined) return null;

  const key = openMatch[1];
  const start = openMatch.index;
  const tokenRe = /\{\{#if\s+[\w.]+\}\}|\{\{\/if(?:\s+[\w.]+)?\}\}/g;
  tokenRe.lastIndex = start + openMatch[0].length;

  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(source))) {
    if (m[0].startsWith('{{#if')) {
      depth++;
    } else {
      depth--;
      if (depth === 0) {
        const end = m.index + m[0].length;
        return {
          key,
          match: source.slice(start, end),
          inner: source.slice(start + openMatch[0].length, m.index),
          index: start,
        };
      }
    }
  }
  return null;
}

/** Repeatedly extracts and resolves {{#if key}} blocks (innermost-first via
 * recursion into `inner` before splicing back), dropping the block entirely
 * when scalars[key] is falsy and keeping (recursively-resolved) inner
 * content otherwise. */
function renderConditionals(source: string, scalars: Record<string, string>): string {
  let out = source;
  while (true) {
    const block = extractIfBlock(out);
    if (!block) break;
    const rendered = scalars[block.key] ? renderConditionals(block.inner, scalars) : '';
    out = out.slice(0, block.index) + rendered + out.slice(block.index + block.match.length);
  }
  return out;
}

/**
 * Resolves BOTH conditional forms — {{#if key}}...{{/if}} and bare
 * {{#key}}...{{/key}} — against any key-value map, PLUS the inverse form
 * {{^key}}...{{/key}} (real Handlebars: shows its content when the key is
 * FALSY, the mirror image of {{#key}}). The inverse form exists specifically
 * for "show the real thing if it's set, otherwise show a fallback" patterns
 * — e.g. a photo vs. a placeholder avatar icon — which {{#key}} alone can't
 * express (it can only hide-or-show one block, not pick between two).
 * Originally only used for the top-level scalars (name, jobTitle, etc). Now
 * also called from inside each loop's per-item callback with that item's
 * own values map (exp.description, project.url, etc) — see renderLoop calls
 * below. This is what makes {{#exp.description}}...{{/exp.description}}
 * legitimately work now: previously conditionals only ever evaluated once,
 * globally, before any per-entry data existed, so a per-entry conditional
 * could never fire no matter how it was written. Calling this same resolver
 * a second time, per item, with that item's own field map, means it now
 * genuinely can.
 */
function renderScalarConditionals(html: string, values: Record<string, string>): string {
  let out = renderConditionals(html, values);
  for (const key of Object.keys(values)) {
    while (true) {
      const block = extractBlock(out, [key]);
      if (!block) break;
      out = out.slice(0, block.index) + (values[key] ? block.inner : '') + out.slice(block.index + block.match.length);
    }
    while (true) {
      const block = extractBlock(out, [key], '^');
      if (!block) break;
      out = out.slice(0, block.index) + (values[key] ? '' : block.inner) + out.slice(block.index + block.match.length);
    }
  }
  return out;
}

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
  sectionId: string,
  entry: { id?: string; values?: Record<string, unknown> },
  fields: Array<{ key: string; label: string; kind: string }>,
): string {
  const values = entry.values ?? {};
  const entryId = entry.id ?? '';
  return fields
    .map((field) => {
      const val = values[field.key];
      if (val === undefined || val === null || val === '') return '';
      if (field.kind === 'list' && Array.isArray(val)) {
        return `<div class="cf-field"><span class="cf-field-label">${escHtml(field.label)}:</span> ${escHtml(val.map(String).join(', '))}</div>`;
      }
      if (field.kind === 'date') {
        return `<div class="cf-field"><span class="cf-field-label">${escHtml(field.label)}:</span> ${escHtml(String(val))}</div>`;
      }
      if (field.kind === 'richtext') {
        return `<div class="cf-field cf-field--richtext"><span class="cf-field-label">${escHtml(field.label)}</span>${wrapField(sectionId, entryId, field.key, String(val).replace(/\n/g, '<br>'))}</div>`;
      }
      return `<div class="cf-field"><span class="cf-field-label">${escHtml(field.label)}:</span> ${wrapField(sectionId, entryId, field.key, escHtml(String(val)))}</div>`;
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

  // wrapField must only be applied when the raw value is non-empty —
  // wrapping an empty string still yields a non-empty span tag, which
  // would make {{#jobTitle}}-style conditionals (checked against this same
  // `scalars` map's truthiness below) always fire even when the field is
  // genuinely blank. `field()` preserves '' as '' so conditionals keep
  // working exactly as before; only truthy values become click-to-edit.
  const summaryEntryId = summarySection?.entries[0]?.id ?? '';
  const field = (fieldKey: string, raw: string): string =>
    summarySection && raw ? wrapField(summarySection.id, summaryEntryId, fieldKey, escHtml(raw)) : escHtml(raw);

  const scalars: Record<string, string> = {
    name:     resume.title ? wrapField(CF_TITLE_SECTION_ID, CF_TITLE_ENTRY_ID, CF_TITLE_FIELD_KEY, escHtml(resume.title)) : '',
    firstName: field('firstName', sv.firstName ?? ''),
    lastName:  field('lastName',  sv.lastName  ?? ''),
    jobTitle: field('jobTitle', sv.jobTitle ?? ''),
    email:    field('email',    sv.email    ?? ''),
    phone:    field('phone',    sv.phone    ?? ''),
    location: field('location', sv.location ?? ''),
    linkedin: field('linkedin', sv.linkedin ?? ''),
    website:  field('website',  sv.website  ?? ''),
    // summary text may contain basic HTML; don't double-escape it
    summary:  summarySection && sv.text ? wrapField(summarySection.id, summaryEntryId, 'text', sv.text) : (sv.text ?? ''),
    accentColor:     accentColor,
    accentColorSoft: mixToward(accentColor, [255, 255, 255], 0.88),
    accentColorDark: mixToward(accentColor, [0, 0, 0], 0.25),
    // Cloudinary-hosted photo URL, set via the resume editor's photo
    // uploader (see uploads/cloudinary.service.ts) -- not escHtml'd since
    // it's only ever used in a src="" attribute, never as visible text.
    photoUrl: resume.theme?.photoUrl ?? '',
  };

  let out = templateHtml;

  // ── Scalar substitution ───────────────────────────────────────────────────
  for (const [k, v] of Object.entries(scalars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }

  // ── Conditionals — both {{#if key}}...{{/if}} and bare {{#key}}...{{/key}} ─
  // Deliberately lenient: real Handlebars closes any block with a bare
  // {{/if}}, and uses the exact same {{#x}}...{{/x}} syntax for both looping
  // and a plain truthy check — no separate #if form required. That's what
  // models trained on real Handlebars overwhelmingly write regardless of
  // how explicitly the system prompt asks for something stricter. Matching
  // the model's natural output is far more reliable than continuing to
  // demand a syntax it won't consistently produce. See renderScalarConditionals.
  out = renderScalarConditionals(out, scalars);

  // ── {{#experiences}} ... {{/experiences}} ────────────────────────────────
  const expSection = resume.sections.find((s) => s.type === 'experience');
  out = renderLoop(out, ['experiences', 'experience'], expSection?.entries ?? [], (tmpl, e) => {
    const v = (e.values ?? {}) as Record<string, string>;
    const wrap = (key: string, raw: string) => (raw ? wrapField(expSection!.id, e.id, key, raw) : raw);
    const fields = {
      'exp.title':       wrap('title', escHtml(v.title ?? '')),
      'exp.company':     wrap('company', escHtml(v.company ?? '')),
      'exp.location':    wrap('location', escHtml(v.location ?? '')),
      'exp.startDate':   fmtDate(v.startDate),
      'exp.endDate':     v.endDate ? fmtDate(v.endDate) : 'Present',
      'exp.dateRange':   dateRange(v.startDate, v.endDate),
      // description may contain \n — convert to <br> for HTML output
      'exp.description': wrap('description', (v.description ?? '').replace(/\n/g, '<br>')),
    };
    return wrapEntry(expSection!.id, e.id, interpolate(renderScalarConditionals(tmpl, fields), fields));
  });

  // ── {{#education}} ... {{/education}} ────────────────────────────────────
  const eduSection = resume.sections.find((s) => s.type === 'education');
  out = renderLoop(out, 'education', eduSection?.entries ?? [], (tmpl, e) => {
    const v = (e.values ?? {}) as Record<string, string>;
    const wrap = (key: string, raw: string) => (raw ? wrapField(eduSection!.id, e.id, key, raw) : raw);
    const fields = {
      'edu.degree':    wrap('degree', escHtml(v.degree ?? '')),
      'edu.school':    wrap('school', escHtml(v.school ?? '')),
      'edu.startDate': fmtDate(v.startDate),
      'edu.endDate':   v.endDate ? fmtDate(v.endDate) : '',
      'edu.dateRange': dateRange(v.startDate, v.endDate === '' ? undefined : v.endDate),
    };
    return wrapEntry(eduSection!.id, e.id, interpolate(renderScalarConditionals(tmpl, fields), fields));
  });

  // ── {{#skills}} ... {{/skills}} ──────────────────────────────────────────
  const skillsSection = resume.sections.find((s) => s.type === 'skills');
  out = renderLoop(out, 'skills', skillsSection?.entries ?? [], (tmpl, e) => {
    const v = (e.values ?? {}) as Record<string, string>;
    const name = escHtml(v.name ?? '');
    const fields = { 'skill.name': name ? wrapField(skillsSection!.id, e.id, 'name', name) : name };
    return wrapEntry(skillsSection!.id, e.id, interpolate(renderScalarConditionals(tmpl, fields), fields));
  });

  // ── {{#certifications}} ... {{/certifications}} ──────────────────────────
  const certSection = resume.sections.find((s) => s.type === 'certifications');
  out = renderLoop(out, 'certifications', certSection?.entries ?? [], (tmpl, e) => {
    const v = (e.values ?? {}) as Record<string, string>;
    const wrap = (key: string, raw: string) => (raw ? wrapField(certSection!.id, e.id, key, raw) : raw);
    const fields = {
      'cert.name':   wrap('name', escHtml(v.name ?? '')),
      'cert.issuer': wrap('issuer', escHtml(v.issuer ?? '')),
      'cert.date':   fmtDate(v.date),
    };
    return wrapEntry(certSection!.id, e.id, interpolate(renderScalarConditionals(tmpl, fields), fields));
  });

  // ── {{#projects}} ... {{/projects}} ──────────────────────────────────────
  const projectsSection = resume.sections.find((s) => s.type === 'projects');
  out = renderLoop(out, 'projects', projectsSection?.entries ?? [], (tmpl, e) => {
    const v = (e.values ?? {}) as Record<string, string>;
    const wrap = (key: string, raw: string) => (raw ? wrapField(projectsSection!.id, e.id, key, raw) : raw);
    const fields = {
      'project.name':        wrap('name', escHtml(v.name ?? '')),
      'project.description': wrap('description', (v.description ?? '').replace(/\n/g, '<br>')),
      'project.url':         wrap('url', escHtml(v.url ?? '')),
    };
    return wrapEntry(projectsSection!.id, e.id, interpolate(renderScalarConditionals(tmpl, fields), fields));
  });

  // ── {{#languages}} ... {{/languages}} ────────────────────────────────────
  const languagesSection = resume.sections.find((s) => s.type === 'languages');
  out = renderLoop(out, 'languages', languagesSection?.entries ?? [], (tmpl, e) => {
    const v = (e.values ?? {}) as Record<string, string>;
    const wrap = (key: string, raw: string) => (raw ? wrapField(languagesSection!.id, e.id, key, raw) : raw);
    const fields = {
      'lang.name':        wrap('name', escHtml(v.name ?? '')),
      'lang.proficiency': wrap('proficiency', escHtml(v.proficiency ?? '')),
    };
    return wrapEntry(languagesSection!.id, e.id, interpolate(renderScalarConditionals(tmpl, fields), fields));
  });

  // ── {{#references}} ... {{/references}} ──────────────────────────────────
  const referencesSection = resume.sections.find((s) => s.type === 'references');
  out = renderLoop(out, 'references', referencesSection?.entries ?? [], (tmpl, e) => {
    const v = (e.values ?? {}) as Record<string, string>;
    const wrap = (key: string, raw: string) => (raw ? wrapField(referencesSection!.id, e.id, key, raw) : raw);
    const fields = {
      'ref.name':         wrap('name', escHtml(v.name ?? '')),
      'ref.relationship': wrap('relationship', escHtml(v.relationship ?? '')),
      'ref.contact':      wrap('contact', escHtml(v.contact ?? '')),
    };
    return wrapEntry(referencesSection!.id, e.id, interpolate(renderScalarConditionals(tmpl, fields), fields));
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
    const sectionFields = { 'section.title': wrapSectionTitle(section.id, escHtml(section.title ?? '')) };
    const withTitle = interpolate(renderScalarConditionals(tmpl, sectionFields), sectionFields);
    return renderLoop(withTitle, 'entries', section.entries ?? [], (entryTmpl, entry) => {
      const entryFields = { 'entry.fields': renderEntryFieldsAsHtml(section.id, entry, section.fields ?? []) };
      return wrapEntry(section.id, entry.id, interpolate(renderScalarConditionals(entryTmpl, entryFields), entryFields));
    });
  });

  return out;
}