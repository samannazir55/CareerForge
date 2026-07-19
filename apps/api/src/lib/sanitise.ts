/**
 * Trims and length-caps a piece of free-text user input before it's stored
 * or interpolated into an AI prompt. Two concerns this addresses:
 *  - Storage: an unbounded string (bio, notes, headline, a pasted job
 *    description...) can bloat a Postgres row/index and, since several of
 *    these fields get echoed back into the DOM (public portfolio, resume
 *    preview), a saved value should already be a reasonable size rather
 *    than relying on every render site to re-truncate.
 *  - Cost/abuse: several of these same fields (jobDescription, notes,
 *    context passed into coachApi/aiProvider calls) end up inside an LLM
 *    prompt. An unbounded paste is a cheap way to run up API cost or push
 *    a request over a provider's context limit.
 *
 * Deliberately dumb — no HTML stripping, no profanity filtering. Those are
 * separate concerns: React already escapes text content by default so this
 * isn't standing in for XSS protection, it's just trim + cap.
 */
export const sanitise = (v: unknown, maxLen = 10000): string =>
  typeof v === 'string' ? v.trim().slice(0, maxLen) : '';
