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
  'name', 'firstName', 'lastName', 'jobTitle', 'email', 'phone', 'location', 'linkedin', 'website',
  'summary', 'accentColor', 'accentColorSoft', 'accentColorDark', 'photoUrl',
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

  // Strip HTML comments before scanning -- placeholder-like text inside a
  // <!-- --> comment (e.g. a documentation note showing example syntax)
  // isn't real template code and shouldn't be flagged as if it were. Keeps
  // the same string length by replacing with spaces rather than deleting,
  // so nothing downstream needs to worry about shifted indices.
  const html = templateHtml.replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length));

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
  for (const m of html.matchAll(ifOpenRe)) {
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
  const ifCloseCount = (html.match(/\{\{\/if(?:\s+[\w.]+)?\}\}/g) ?? []).length;
  if (ifOpenCount !== ifCloseCount) {
    errors.push({
      tag: 'if',
      message: `Found ${ifOpenCount} {{#if ...}} open(s) but ${ifCloseCount} {{/if...}} close(s) — unbalanced, one or more conditionals will render as literal text.`,
    });
  }



  // ── Loop tags & inverse blocks: {{#tag}}/{{^tag}} ... {{/tag}} ──────────
  // {{#tag}} is valid for a real loop tag (ALLOWED_LOOP_TAGS, via renderLoop)
  // OR a real scalar/per-entry field (via renderScalarConditionals, which
  // treats a bare {{#scalarKey}}...{{/scalarKey}} as a truthy conditional).
  // {{^tag}} (Handlebars inverse — show if FALSY, e.g. "show a fallback
  // icon if no photo is set") is ONLY valid for scalar/per-entry fields —
  // renderLoop has no inverse handling at all, so {{^experiences}} would
  // never fire no matter how it's written, even though {{#experiences}} is
  // perfectly fine. Anything else ({{#each}}, {{#item}}, {{#this}}, a
  // misspelled/invented tag) is never going to render either way.
  const hashOpenRe = /\{\{#(?!if\s)([\w.]+)\}\}/g;
  const caretOpenRe = /\{\{\^([\w.]+)\}\}/g;
  const closeRe = /\{\{\/(?!if\b)([\w.]+)\}\}/g;

  const hashOpenCounts = new Map<string, number>();
  const caretOpenCounts = new Map<string, number>();
  const closeCounts = new Map<string, number>();
  const seenTags = new Set<string>();

  for (const m of html.matchAll(hashOpenRe)) {
    hashOpenCounts.set(m[1], (hashOpenCounts.get(m[1]) ?? 0) + 1);
    seenTags.add(m[1]);
  }
  for (const m of html.matchAll(caretOpenRe)) {
    caretOpenCounts.set(m[1], (caretOpenCounts.get(m[1]) ?? 0) + 1);
    seenTags.add(m[1]);
  }
  for (const m of html.matchAll(closeRe)) {
    closeCounts.set(m[1], (closeCounts.get(m[1]) ?? 0) + 1);
    seenTags.add(m[1]);
  }

  const isFieldTag = (tag: string) => ALLOWED_CONDITIONAL_KEYS.has(tag) || ALLOWED_ITEM_FIELDS.has(tag);

  for (const tag of seenTags) {
    const hashes = hashOpenCounts.get(tag) ?? 0;
    const carets = caretOpenCounts.get(tag) ?? 0;

    if (hashes > 0 && !ALLOWED_LOOP_TAGS.has(tag) && !isFieldTag(tag)) {
      errors.push({
        tag,
        message:
          `{{#${tag}}} isn't a construct this renderer implements — it will never render, no matter ` +
          `how it's written. Supported loop tags: ${[...ALLOWED_LOOP_TAGS].filter((t) => t !== 'experience').join(', ')}. ` +
          `Supported conditional fields: ${[...ALLOWED_CONDITIONAL_KEYS].join(', ')}. ` +
          `Supported per-entry fields: ${[...ALLOWED_ITEM_FIELDS].join(', ')}.`,
      });
    }
    if (carets > 0 && !isFieldTag(tag)) {
      errors.push({
        tag,
        message: ALLOWED_LOOP_TAGS.has(tag)
          ? `{{^${tag}}} isn't supported for loop tags — inverse blocks only work on scalar or per-entry ` +
            `fields (e.g. {{^photoUrl}}), not on ${tag}. There's no "show this if the list is empty" form.`
          : `{{^${tag}}} isn't a construct this renderer implements — it will never render. ` +
            `Supported conditional fields: ${[...ALLOWED_CONDITIONAL_KEYS].join(', ')}. ` +
            `Supported per-entry fields: ${[...ALLOWED_ITEM_FIELDS].join(', ')}.`,
      });
    }

    const closes = closeCounts.get(tag) ?? 0;
    if (hashes + carets !== closes) {
      errors.push({
        tag,
        message: `{{#${tag}}}/{{^${tag}}} appears ${hashes + carets} time(s) total but {{/${tag}}} appears ${closes} time(s) — unbalanced, extra tags will render as literal text.`,
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