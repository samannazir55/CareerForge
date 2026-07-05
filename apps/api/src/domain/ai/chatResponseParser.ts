import type { Resume } from '@careerforge/schema';

export interface ParsedChatResponse {
  reply: string;
  resumeUpdate?: Partial<Pick<Resume, 'title' | 'sections'>>;
  suggestions: string[];
  /**
   * True when something clearly went wrong extracting structured data from
   * the model's response — a RESUME_UPDATE marker was present but its JSON
   * payload was missing/unparsable/truncated. Callers (the fallback
   * provider chain in particular) can use this to treat a "successful"
   * 200-ish completion as a soft failure worth retrying against another
   * provider, rather than silently accepting a reply with no update.
   */
  degraded: boolean;
}

type ResumeUpdate = Partial<Pick<Resume, 'title' | 'sections'>>;

/**
 * Scans forward from `fromIdx` for the first `{` and returns the JSON value
 * spanning to its *matching* `}` (brace-depth balanced), plus the index just
 * past it — or null if there's no opening brace, the braces never balance
 * (truncated response), or the matched span isn't valid JSON.
 *
 * This replaces a single greedy `/\{[\s\S]*\}/` match, which spans from the
 * FIRST `{` to the LAST `}` anywhere in the remaining string. That's unsafe
 * the moment there's more than one brace-delimited thing in the text — e.g.
 * a reasoning model's internal analysis pass mentioning an example object
 * ("...format it like {\"title\": \"...\"}...") before the real payload will
 * cause the greedy match to span from that example all the way through the
 * actual RESUME_UPDATE JSON, producing an invalid, unparsable blob. Balanced
 * scanning from an anchored starting point only ever captures one complete,
 * self-contained JSON value.
 */
export function extractBalancedJson(text: string, fromIdx: number): { value: unknown; endIdx: number } | null {
  const start = text.indexOf('{', fromIdx);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          return { value: JSON.parse(candidate), endIdx: i + 1 };
        } catch {
          return null; // well-balanced but not valid JSON — don't widen the search
        }
      }
    }
  }

  return null; // braces never closed — truncated response (e.g. ran out of max_tokens)
}

// Exact (case-insensitive, trimmed) strings pulled from this file's own
// prompt vocabulary and from the field labels defined in SAMPLE_RESUME /
// the RESUME_UPDATE schema description on the frontend. A real user's data
// being *literally* one of these strings is vanishingly unlikely — "Job
// Title" is not a job title anyone actually has — so an exact match here is
// a strong, low-false-positive signal that the model echoed a placeholder
// or field-label description as if it were the answer, rather than
// substituting the user's real information as instructed.
const PLACEHOLDER_STRINGS = new Set([
  'full name', 'your full name', "the person's full name", 'your name', 'name',
  'job title', 'their current job title', 'your job title', 'current job title',
  'company', 'their company', 'your company',
  'location', 'their location', 'your location', 'city, state', "their city, state",
  'summary', 'professional summary', '2-3 sentence professional summary',
  'degree', 'school', 'skill', 'skill name', 'their email', 'their phone', 'your email', 'your phone',
  '...', 'n/a', 'tbd', 'unknown', 'example', 'placeholder',
]);

function looksLikePlaceholder(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && PLACEHOLDER_STRINGS.has(normalized);
}

/**
 * True if any entry value anywhere in `sections` is a literal echo of the
 * prompt's own placeholder vocabulary. Scanning happens across every
 * section/entry rather than stopping at the first match purely so the
 * check is unambiguous either way — there's no partial-acceptance path
 * here (see isPlausibleResumeUpdate below), so there's no need to
 * short-circuit for performance on what's always a small array.
 */
function containsPlaceholderEntryValues(sections: unknown): boolean {
  if (!Array.isArray(sections)) return false;
  for (const section of sections) {
    if (!section || typeof section !== 'object') continue;
    const entries = (section as Record<string, unknown>).entries;
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const values = (entry as Record<string, unknown> | undefined)?.values;
      if (!values || typeof values !== 'object') continue;
      for (const v of Object.values(values as Record<string, unknown>)) {
        if (looksLikePlaceholder(v)) return true;
      }
    }
  }
  return false;
}

export function isPlausibleResumeUpdate(candidate: unknown): candidate is ResumeUpdate {
  if (!candidate || typeof candidate !== 'object') return false;
  const c = candidate as Record<string, unknown>;

  // A placeholder-echoing title is a strong enough signal on its own to
  // reject the whole candidate, even if sections happen to look fine —
  // both failure modes observed in practice (a bare illustrative fragment,
  // and a complete-but-fake resume) had this in common.
  if (looksLikePlaceholder(c.title)) return false;
  if (containsPlaceholderEntryValues(c.sections)) return false;

  // Require a non-trivial title or a sections array with at least one real
  // section — guards against matching a small illustrative fragment (e.g.
  // `{"title": "..."}`) that a model's reasoning pass might mention while
  // it plans out the real answer.
  if (typeof c.title === 'string' && c.title.trim().length > 1) return true;
  if (Array.isArray(c.sections) && c.sections.length > 0) return true;
  return false;
}

/**
 * For prompts that ask a model to "return ONLY valid JSON" with no marker at
 * all (extractResumeFromText's CV-parsing prompt, across all three
 * adapters) — scans for the first balanced JSON object anywhere in the text
 * rather than assuming the response starts with `{`. This is the same
 * failure mode as the chat endpoint: a reasoning model can still preface
 * its answer with analysis text even when told not to, and the old
 * `/\{[\s\S]*\}/` greedy match would silently produce invalid JSON (or
 * match nothing) the moment it did, falling back to `{}` with no signal
 * that extraction actually failed. Returns undefined — never a lossy `{}` —
 * so callers can tell "nothing usable came back" apart from "the model
 * genuinely extracted nothing," and react accordingly (e.g. surface a real
 * error to the user instead of a silently-empty import).
 */
export function extractResumeJson(rawText: string): Partial<Pick<Resume, 'title' | 'sections'>> | undefined {
  let searchFrom = 0;
  while (searchFrom < rawText.length) {
    const extracted = extractBalancedJson(rawText, searchFrom);
    if (!extracted) return undefined; // no more braces, or they never balanced
    if (isPlausibleResumeUpdate(extracted.value)) return extracted.value;
    // That balanced object wasn't a plausible resume (e.g. a small example
    // fragment in a reasoning preamble) — keep scanning past it rather than
    // giving up, in case the real payload follows later in the text.
    searchFrom = extracted.endIdx;
  }
  return undefined;
}

/**
 * Extracts the RESUME_UPDATE payload and SUGGESTIONS list from a raw LLM
 * response, returning the remaining reply text with both fully stripped out.
 *
 * Supported RESUME_UPDATE shapes (models vary in how faithfully they follow
 * the system prompt's exact format):
 *   - "RESUME_UPDATE:" followed by JSON (the instructed format)
 *   - "<RESUME_UPDATE>...</RESUME_UPDATE>" / an unclosed "<RESUME_UPDATE>" tag
 *   - a bare "RESUME_UPDATE" line with no colon or tag (seen from reasoning
 *     models whose analysis pass drifts from the exact instructed marker)
 *   - no marker at all, just the resume JSON as the whole message
 *
 * The critical rule that makes this safe: JSON extraction is always anchored
 * to *after* a located RESUME_UPDATE marker (in whichever of the first three
 * shapes it appears), using a balanced-brace scan — never an unanchored,
 * greedy "find any braces in the text" scan. The bare-JSON-whole-message
 * case (no marker anywhere) is the sole exception, and is checked last, only
 * once no marker was found anywhere in the text, specifically so that a
 * reasoning preamble mentioning example braces *before* a real, later marker
 * can never be mistaken for the payload.
 */
export function parseChatResponse(rawText: string): ParsedChatResponse {
  let text = rawText;
  let degraded = false;

  // --- SUGGESTIONS ---------------------------------------------------------
  let suggestions: string[] = [];
  const suggestionsMatch = text.match(
    /<SUGGESTIONS>([\s\S]*?)<\/SUGGESTIONS>|SUGGESTIONS\s*:?\s*(\[[\s\S]*?\]|(?:\r?\n\s*[-*•]\s*.+)+)/i,
  );
  if (suggestionsMatch) {
    const raw = suggestionsMatch[1] ?? suggestionsMatch[2] ?? '';
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        suggestions = JSON.parse(arrMatch[0]) as string[];
      } catch {
        suggestions = [];
      }
    } else {
      // Bare bullet/dash list instead of a JSON array.
      suggestions = raw
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
        .filter(Boolean);
    }
    text = (text.slice(0, suggestionsMatch.index) + text.slice(suggestionsMatch.index! + suggestionsMatch[0].length)).trim();
  }

  // --- RESUME_UPDATE ---------------------------------------------------------
  let resumeUpdate: ResumeUpdate | undefined;

  // Matches "<RESUME_UPDATE>", "RESUME_UPDATE:", or a bare "RESUME_UPDATE" —
  // whichever comes first — and nothing else. Deliberately does NOT match on
  // a stray "{" anywhere; that's only ever considered in the no-marker branch
  // below, after confirming this regex found nothing at all.
  const markerMatch = text.match(/<RESUME_UPDATE>|RESUME_UPDATE\s*:?/i);

  if (markerMatch) {
    const markerStart = markerMatch.index!;
    const afterMarker = markerStart + markerMatch[0].length;
    const reply = text.slice(0, markerStart).trim();

    const extracted = extractBalancedJson(text, afterMarker);
    if (extracted && isPlausibleResumeUpdate(extracted.value)) {
      resumeUpdate = extracted.value;
      // Preserve any genuine trailing conversational text after the JSON
      // (SUGGESTIONS has already been stripped above), and drop a matching
      // "</RESUME_UPDATE>" close tag immediately following the payload if
      // the model used the tag form.
      const tail = text
        .slice(extracted.endIdx)
        .replace(/^\s*<\/RESUME_UPDATE>/i, '')
        .trim();
      text = [reply, tail].filter(Boolean).join('\n\n').trim();
    } else {
      // Marker found but the payload after it didn't extract cleanly —
      // truncated response, malformed JSON, or just an example fragment.
      // Never leave the marker or a partial JSON blob visible to the user;
      // fall back to the clean text before the marker and flag this as a
      // degraded response so callers can decide whether to retry.
      text = reply;
      degraded = true;
    }
  } else {
    // No marker anywhere — some small/weak models skip the instructed
    // wrapper entirely and just return the raw resume JSON as the whole
    // message (optionally with a short preamble before it).
    const extracted = extractBalancedJson(text, 0);
    if (extracted && isPlausibleResumeUpdate(extracted.value)) {
      resumeUpdate = extracted.value;
      text = text.slice(0, text.indexOf('{')).trim();
    }
  }

  // If the entire message was consumed as structured data, there's nothing
  // left to show the user — give them a short human-readable acknowledgement
  // instead of an empty chat bubble.
  if (!text.trim() && resumeUpdate) {
    text = "Got it — I've updated your resume with that.";
  }

  // Truncation without ever reaching a marker: no RESUME_UPDATE/SUGGESTIONS
  // marker was found anywhere, no resumeUpdate was extracted, and the reply
  // doesn't end in terminal punctuation. A genuine conversational reply
  // (a question, an acknowledgement) almost always ends with . ! ? or an
  // emoji; text that just stops mid-clause is a strong signal the model ran
  // out of max_tokens mid-narration, before ever writing the marker it was
  // building up to. This case previously fell through as a normal-looking,
  // non-degraded reply — silently losing the update with nothing for the
  // fallback chain to react to. A long-ish reply is required before this
  // fires, so a legitimately terse-but-complete reply isn't misflagged.
  if (!resumeUpdate && !markerMatch && text.trim().length > 40 && !/[.!?"'\u{1F300}-\u{1FAFF}\u2600-\u27BF]\s*$/u.test(text.trim())) {
    degraded = true;
  }

  // Last-resort safety net: if a response body somehow still contains a raw
  // marker token at this point (e.g. a second, unmatched occurrence), never
  // let it reach the user verbatim.
  if (/RESUME_UPDATE|<\/?SUGGESTIONS>/i.test(text)) {
    degraded = true;
    text = text.replace(/RESUME_UPDATE\s*:?/gi, '').replace(/<\/?SUGGESTIONS>/gi, '').trim();
    if (!text) text = "Got it — let's keep going.";
  }

  return { reply: text.trim(), resumeUpdate, suggestions, degraded };
}
