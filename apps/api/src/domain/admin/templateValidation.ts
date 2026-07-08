// ---------------------------------------------------------------------------
// Dynamic template placeholder validator
// ---------------------------------------------------------------------------
// The dynamic-template renderer (dynamicTemplateRenderer.ts) does a single
// non-greedy regex pass per loop tag: {{#tag}}...{{/tag}}. If a template has
// an unequal number of opens vs. closes for a given tag — e.g. the AI
// generator hard-codes the loop body twice (once per imagined entry) but
// only emits one closing tag — the non-greedy match only consumes up to the
// FIRST close, and any extra {{#tag}}/{{/tag}} left over renders as literal
// dead text on real users' resumes. This validator catches that class of
// bug BEFORE a template is saved, by checking every {{#x}}/{{/x}} and
// {{#if x}}/{{/if x}} pair is balanced.
//
// This is intentionally a balance check, not a full parser: it doesn't
// verify nesting order, only that counts match per tag name. That's enough
// to catch the "duplicated open, single close" and "orphaned close" bugs
// we've actually seen, without needing a real grammar for what is still,
// by design, plain string substitution rather than a templating engine.
// ---------------------------------------------------------------------------

export interface TemplateValidationError {
  tag: string;
  opens: number;
  closes: number;
  message: string;
}

const SINGULAR_PLURAL_ALIASES: Record<string, string> = {
  experience: 'experiences',
};

function normalizeTag(tag: string): string {
  return SINGULAR_PLURAL_ALIASES[tag] ?? tag;
}

/**
 * Scans templateHtml for every {{#tag}}/{{/tag}} loop block and every
 * {{#if key}}/{{/if key}} conditional, and returns one error per tag/key
 * whose open and close counts don't match. Empty array = valid.
 */
export function validateTemplateHtml(templateHtml: string): TemplateValidationError[] {
  const errors: TemplateValidationError[] = [];

  // ── Loop blocks: {{#tagname}} / {{/tagname}} ──────────────────────────
  // Excludes "if ..." forms, which are handled separately below.
  const openRe = /\{\{#(?!if\s)([\w.]+)\}\}/g;
  const closeRe = /\{\{\/(?!if\s)([\w.]+)\}\}/g;

  const openCounts = new Map<string, number>();
  const closeCounts = new Map<string, number>();

  for (const m of templateHtml.matchAll(openRe)) {
    const tag = normalizeTag(m[1]);
    openCounts.set(tag, (openCounts.get(tag) ?? 0) + 1);
  }
  for (const m of templateHtml.matchAll(closeRe)) {
    const tag = normalizeTag(m[1]);
    closeCounts.set(tag, (closeCounts.get(tag) ?? 0) + 1);
  }

  const allTags = new Set([...openCounts.keys(), ...closeCounts.keys()]);
  for (const tag of allTags) {
    const opens = openCounts.get(tag) ?? 0;
    const closes = closeCounts.get(tag) ?? 0;
    if (opens !== closes) {
      errors.push({
        tag,
        opens,
        closes,
        message:
          opens > closes
            ? `{{#${tag}}} appears ${opens} time(s) but {{/${tag}}} only ${closes} time(s) — ` +
              `a loop body was likely duplicated instead of left to repeat on its own. ` +
              `Extra {{#${tag}}}/{{/${tag}}} tags will render as literal text.`
            : `{{/${tag}}} appears ${closes} time(s) but {{#${tag}}} only ${opens} time(s) — ` +
              `an orphaned closing tag will render as literal text.`,
      });
    }
  }

  // ── Conditionals: {{#if key}} / {{/if key}} ───────────────────────────
  const ifOpenRe = /\{\{#if\s+([\w.]+)\}\}/g;
  const ifCloseRe = /\{\{\/if\s+([\w.]+)\}\}/g;

  const ifOpenCounts = new Map<string, number>();
  const ifCloseCounts = new Map<string, number>();

  for (const m of templateHtml.matchAll(ifOpenRe)) {
    ifOpenCounts.set(m[1], (ifOpenCounts.get(m[1]) ?? 0) + 1);
  }
  for (const m of templateHtml.matchAll(ifCloseRe)) {
    ifCloseCounts.set(m[1], (ifCloseCounts.get(m[1]) ?? 0) + 1);
  }

  const allIfKeys = new Set([...ifOpenCounts.keys(), ...ifCloseCounts.keys()]);
  for (const key of allIfKeys) {
    const opens = ifOpenCounts.get(key) ?? 0;
    const closes = ifCloseCounts.get(key) ?? 0;
    if (opens !== closes) {
      errors.push({
        tag: `if ${key}`,
        opens,
        closes,
        message: `{{#if ${key}}} (${opens}) and {{/if ${key}}} (${closes}) counts don't match.`,
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
    throw new Error(`Template has unbalanced placeholder tags:\n${details}`);
  }
}
