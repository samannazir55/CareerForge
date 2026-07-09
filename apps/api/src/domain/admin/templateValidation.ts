// ---------------------------------------------------------------------------
// Dynamic template placeholder validator
// ---------------------------------------------------------------------------
// This validates against an ALLOWLIST of exactly what dynamicTemplateRenderer.ts
// implements — not just "are the tags balanced". Balance alone misses real
// bugs we've actually seen in AI-generated templates:
//
//   {{#jobTitle}}...{{/jobTitle}}       — balanced, but "jobTitle" isn't a
//                                          registered loop tag, so it never
//                                          renders and sits as dead text.
//   {{#if location}}...{{/if}}          — balanced-looking, but the renderer's
//                                          conditional regex requires the
//                                          closing tag to repeat the exact
//                                          key ({{/if location}}); a bare
//                                          {{/if}} never matches.
//   {{#if exp.location}}...{{/if ...}}  — conditionals only evaluate against
//                                          top-level scalars, BEFORE per-entry
//                                          loop data exists. Using one on a
//                                          loop-item field can never work,
//                                          no matter how it's closed.
//   {{#each x.split '\n'}}...{{/each}}  — invented syntax with no renderer
//                                          support at all; balanced, but
//                                          categorically unimplementable.
//
// All four are balanced open/close pairs, so a pure count-based check (the
// previous version of this file) passes every one of them. This version
// instead checks tag names and conditional keys against exactly what
// dynamicTemplateRenderer.ts is capable of rendering.
// ---------------------------------------------------------------------------

export interface TemplateValidationError {
  tag: string;
  message: string;
}

// Keep in sync with the renderLoop(...) calls in dynamicTemplateRenderer.ts.
const ALLOWED_LOOP_TAGS = new Set([
  'experiences', 'experience', // alias pair, handled together by the renderer
  'education',
  'skills',
  'certifications',
  'projects',
  'languages',
  'references',
  'customSections',
  'entries', // only meaningful nested inside customSections, but the
             // renderer doesn't enforce nesting context, so neither do we
]);

// Keep in sync with the `scalars` object in dynamicTemplateRenderer.ts —
// these are the ONLY keys {{#if key}} can ever evaluate truthily, since
// conditionals run once, globally, before any per-entry loop data exists.
const ALLOWED_CONDITIONAL_KEYS = new Set([
  'name', 'jobTitle', 'email', 'phone', 'location', 'linkedin', 'website',
  'summary', 'accentColor', 'accentColorSoft', 'accentColorDark',
]);

/**
 * Validates templateHtml against exactly what dynamicTemplateRenderer.ts
 * supports. Returns one error per problem found; empty array = valid.
 */
export function validateTemplateHtml(templateHtml: string): TemplateValidationError[] {
  const errors: TemplateValidationError[] = [];

  // ── Conditionals: {{#if key}} ... {{/if key}} ─────────────────────────
  // Renderer regex is literally /\{\{#if ([\w.]+)\}\}([\s\S]*?)\{\{\/if \1\}\}/g
  // — a backreference requiring the exact same key on both sides. We check
  // three things per {{#if key}} occurrence: the key is in the allowed
  // scalar set, it's not a dotted per-entry field (exp.x / edu.x / etc,
  // which can never work here regardless of spelling), and a matching
  // {{/if key}} with that same exact key exists somewhere in the file.
  const ifOpenRe = /\{\{#if\s+([\w.]+)\}\}/g;
  for (const m of templateHtml.matchAll(ifOpenRe)) {
    const key = m[1];
    if (key.includes('.')) {
      errors.push({
        tag: `if ${key}`,
        message:
          `{{#if ${key}}} conditionally shows a loop-item field, but conditionals only run once, ` +
          `globally, before any per-entry data exists — this can never work. Remove the ` +
          `conditional; the field will already render as empty text if it has no value.`,
      });
      continue;
    }
    if (!ALLOWED_CONDITIONAL_KEYS.has(key)) {
      errors.push({
        tag: `if ${key}`,
        message: `{{#if ${key}}} — "${key}" isn't a real field. Valid conditional keys: ${[...ALLOWED_CONDITIONAL_KEYS].join(', ')}.`,
      });
      continue;
    }
    const closeTag = `{{/if ${key}}}`;
    if (!templateHtml.includes(closeTag)) {
      errors.push({
        tag: `if ${key}`,
        message: `{{#if ${key}}} has no matching {{/if ${key}}} — the closing tag must repeat the exact key (a bare {{/if}} will never match and both tags will render as literal text).`,
      });
    }
  }

  // Bare {{/if}} (no key) is always wrong — flag it even if there's no
  // corresponding {{#if}} nearby, since it'll always render as dead text.
  const bareIfCloseCount = (templateHtml.match(/\{\{\/if\}\}/g) ?? []).length;
  if (bareIfCloseCount > 0) {
    errors.push({
      tag: 'if',
      message: `Found ${bareIfCloseCount} occurrence(s) of {{/if}} with no key. Every {{#if key}} must close with {{/if key}}, repeating the same key.`,
    });
  }

  // ── Loop tags: {{#tag}} ... {{/tag}} ───────────────────────────────────
  // Any tag name here that isn't in ALLOWED_LOOP_TAGS is either a scalar
  // used with the wrong syntax ({{#jobTitle}}) or invented syntax the
  // renderer has never heard of ({{#each}}) — either way it will never
  // render and needs to be caught before save, not balance-checked.
  const openRe = /\{\{#(?!if\s)([\w.]+)\}\}/g;
  const closeRe = /\{\{\/(?!if\b)([\w.]+)\}\}/g;

  const openCounts = new Map<string, number>();
  const closeCounts = new Map<string, number>();
  const seenTags = new Set<string>();

  for (const m of templateHtml.matchAll(openRe)) {
    openCounts.set(m[1], (openCounts.get(m[1]) ?? 0) + 1);
    seenTags.add(m[1]);
  }
  for (const m of templateHtml.matchAll(closeRe)) {
    closeCounts.set(m[1], (closeCounts.get(m[1]) ?? 0) + 1);
    seenTags.add(m[1]);
  }

  for (const tag of seenTags) {
    if (!ALLOWED_LOOP_TAGS.has(tag)) {
      errors.push({
        tag,
        message:
          `{{#${tag}}} isn't a construct this renderer implements — it will never render, no matter ` +
          `how it's written. Supported loop tags: ${[...ALLOWED_LOOP_TAGS].filter((t) => t !== 'experience').join(', ')}.`,
      });
      continue;
    }
    const opens = openCounts.get(tag) ?? 0;
    const closes = closeCounts.get(tag) ?? 0;
    if (opens !== closes) {
      errors.push({
        tag,
        message: `{{#${tag}}} appears ${opens} time(s) but {{/${tag}}} appears ${closes} time(s) — unbalanced, extra tags will render as literal text.`,
      });
    }
  }

  return errors;
}

/** Convenience helper: throws a single readable Error if validation fails. */
export function assertValidTemplateHtml(templateHtml: string): void {
  const errors = validateTemplateHtml(templateHtml);
  if (errors.length > 0) {
    const details = errors.map((e) => `• ${e.message}`).join('\n');
    throw new Error(`Template has unsupported/broken placeholder tags:\n${details}`);
  }
}