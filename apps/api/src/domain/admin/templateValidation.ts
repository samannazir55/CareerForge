// ---------------------------------------------------------------------------
// Dynamic template placeholder validator
// ---------------------------------------------------------------------------
// This validates against an ALLOWLIST of exactly what dynamicTemplateRenderer.ts
// implements — not just "are the tags balanced". Balance alone misses real
// bugs we've actually seen in AI-generated templates:
//
//   {{#jobTitle}}...{{/jobTitle}}       — balanced, but "jobTitle" wasn't a
//                                          registered loop tag (now valid --
//                                          renderer treats bare {{#scalar}}
//                                          as a truthy conditional).
//   {{#if location}}...{{/if}}          — balanced-looking; now valid, the
//                                          renderer accepts a bare {{/if}}.
//   {{#if exp.description}}...{{/if}}   — now ALSO valid: renderer resolves
//   {{#exp.description}}...{{/...}}       per-entry conditionals using that
//                                          item's own field map (see
//                                          renderScalarConditionals calls
//                                          inside each renderLoop callback).
//   {{#each x.split '\n'}}...{{/each}}  — still invented syntax with no
//                                          renderer support; still rejected.
//   {{#project.date}}...{{/...}}        — still rejected: "project.date"
//                                          isn't a real field (only project.
//                                          name/description/url exist) —
//                                          fabricating a plausible-looking
//                                          per-entry field name is just as
//                                          broken as fabricating a top-level
//                                          one, so this still needs an
//                                          allowlist, not just balance.
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
// these are the fields available at the top level, before any loop runs.
const ALLOWED_CONDITIONAL_KEYS = new Set([
  'name', 'jobTitle', 'email', 'phone', 'location', 'linkedin', 'website',
  'summary', 'accentColor', 'accentColorSoft', 'accentColorDark',
]);

// Keep in sync with every `fields` map built inside each renderLoop callback
// in dynamicTemplateRenderer.ts — these are the ONLY per-entry fields that
// genuinely exist on a loop item, and therefore the only dotted keys a
// per-entry conditional can legitimately reference.
const ALLOWED_ITEM_FIELDS = new Set([
  'exp.title', 'exp.company', 'exp.location', 'exp.startDate', 'exp.endDate', 'exp.dateRange', 'exp.description',
  'edu.degree', 'edu.school', 'edu.startDate', 'edu.endDate', 'edu.dateRange',
  'skill.name',
  'cert.name', 'cert.issuer', 'cert.date',
  'project.name', 'project.description', 'project.url',
  'lang.name', 'lang.proficiency',
  'ref.name', 'ref.relationship', 'ref.contact',
  'section.title',
  'entry.fields',
]);


/**
 * Validates templateHtml against exactly what dynamicTemplateRenderer.ts
 * supports. Returns one error per problem found; empty array = valid.
 */
export function validateTemplateHtml(templateHtml: string): TemplateValidationError[] {
  const errors: TemplateValidationError[] = [];

  // ── Conditionals: {{#if key}} ... {{/if}}  OR  {{#if key}} ... {{/if key}} ─
  // The renderer (extractIfBlock/renderConditionals) now accepts EITHER
  // closing form, depth-aware across nesting — matching real Handlebars,
  // where a bare {{/if}} is completely standard. We still check that each
  // key is a real, allowed scalar (not a per-entry field, which can never
  // work here regardless of how it's closed), and that {{#if}} opens and
  // {{/if...}} closes are globally balanced — an imbalance means the
  // renderer's depth-aware matcher will hit an unclosed block somewhere
  // and leave it as literal text, same as an unbalanced loop tag.
  const ifOpenRe = /\{\{#if\s+([\w.]+)\}\}/g;
  let ifOpenCount = 0;
  for (const m of templateHtml.matchAll(ifOpenRe)) {
    ifOpenCount++;
    const key = m[1];
    if (key.includes('.')) {
      if (!ALLOWED_ITEM_FIELDS.has(key)) {
        errors.push({
          tag: `if ${key}`,
          message: `{{#if ${key}}} — "${key}" isn't a real per-entry field. Valid per-entry fields: ${[...ALLOWED_ITEM_FIELDS].join(', ')}.`,
        });
      }
      continue;
    }
    if (!ALLOWED_CONDITIONAL_KEYS.has(key)) {
      errors.push({
        tag: `if ${key}`,
        message: `{{#if ${key}}} — "${key}" isn't a real field. Valid conditional keys: ${[...ALLOWED_CONDITIONAL_KEYS].join(', ')}.`,
      });
    }
  }
  const ifCloseCount = (templateHtml.match(/\{\{\/if(?:\s+[\w.]+)?\}\}/g) ?? []).length;
  if (ifOpenCount !== ifCloseCount) {
    errors.push({
      tag: 'if',
      message: `Found ${ifOpenCount} {{#if ...}} open(s) but ${ifCloseCount} {{/if...}} close(s) — unbalanced, one or more conditionals will render as literal text.`,
    });
  }



  // ── Loop tags: {{#tag}} ... {{/tag}} ───────────────────────────────────
  // A tag name here is valid if it's a real loop tag (ALLOWED_LOOP_TAGS)
  // OR a real scalar field (ALLOWED_CONDITIONAL_KEYS) -- the renderer now
  // treats a bare {{#scalarKey}}...{{/scalarKey}} as a truthy conditional,
  // matching real Handlebars semantics (see dynamicTemplateRenderer.ts).
  // Anything else ({{#each}}, {{#item}}, {{#this}}, a misspelled/invented
  // tag) is never going to render, and needs to be caught before save.
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
    if (!ALLOWED_LOOP_TAGS.has(tag) && !ALLOWED_CONDITIONAL_KEYS.has(tag) && !ALLOWED_ITEM_FIELDS.has(tag)) {
      errors.push({
        tag,
        message:
          `{{#${tag}}} isn't a construct this renderer implements — it will never render, no matter ` +
          `how it's written. Supported loop tags: ${[...ALLOWED_LOOP_TAGS].filter((t) => t !== 'experience').join(', ')}. ` +
          `Supported conditional fields: ${[...ALLOWED_CONDITIONAL_KEYS].join(', ')}. ` +
          `Supported per-entry fields: ${[...ALLOWED_ITEM_FIELDS].join(', ')}.`,
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