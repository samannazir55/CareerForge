import type { Resume } from '@careerforge/schema';

export interface ParsedChatResponse {
  reply: string;
  resumeUpdate?: Partial<Pick<Resume, 'title' | 'sections'>>;
  suggestions: string[];
}

function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? (JSON.parse(match[0]) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Extracts the RESUME_UPDATE payload and SUGGESTIONS list from a raw LLM
 * response, returning the remaining reply text with both fully stripped out.
 *
 * The system prompt asks for a plain "RESUME_UPDATE:" colon marker, but
 * weaker/free models don't reliably follow that exact shape — in practice
 * they sometimes wrap it in XML-ish tags instead
 * ("<RESUME_UPDATE> {...} </RESUME_UPDATE>"), or drop the marker entirely
 * and just return the bare resume JSON as the whole message. A strict
 * colon-only check silently misses those cases: the raw marker (or raw
 * JSON) leaks into the visible chat message, and no update ever reaches
 * the resume state (the preview stays on sample data). This parser accepts
 * all three shapes — including an unclosed tag — so a model formatting
 * quirk degrades gracefully instead of breaking both the chat text and the
 * live preview.
 */
export function parseChatResponse(rawText: string): ParsedChatResponse {
  let text = rawText;

  // --- SUGGESTIONS ---------------------------------------------------------
  let suggestions: string[] = [];
  const suggestionsMatch = text.match(/<SUGGESTIONS>([\s\S]*?)<\/SUGGESTIONS>|SUGGESTIONS:\s*(\[[\s\S]*?\])/i);
  if (suggestionsMatch) {
    const raw = suggestionsMatch[1] ?? suggestionsMatch[2] ?? '';
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        suggestions = JSON.parse(arrMatch[0]) as string[];
      } catch {
        suggestions = [];
      }
    }
    text = (text.slice(0, suggestionsMatch.index) + text.slice(suggestionsMatch.index! + suggestionsMatch[0].length)).trim();
  }

  // --- RESUME_UPDATE ---------------------------------------------------------
  let resumeUpdate: Partial<Pick<Resume, 'title' | 'sections'>> | undefined;

  const closedTagMatch = text.match(/<RESUME_UPDATE>([\s\S]*?)<\/RESUME_UPDATE>/i);
  const openTagIdx = text.search(/<RESUME_UPDATE>/i);
  const colonIdx = text.indexOf('RESUME_UPDATE:');

  if (closedTagMatch) {
    const parsed = safeJsonParse<Partial<Pick<Resume, 'title' | 'sections'>> | null>(closedTagMatch[1], null);
    if (parsed) resumeUpdate = parsed;
    text = (text.slice(0, closedTagMatch.index) + text.slice(closedTagMatch.index! + closedTagMatch[0].length)).trim();
  } else if (openTagIdx !== -1) {
    // Model opened the tag but never closed it — treat everything after as JSON.
    const reply = text.slice(0, openTagIdx);
    const jsonPart = text.slice(openTagIdx).replace(/<RESUME_UPDATE>/i, '');
    const parsed = safeJsonParse<Partial<Pick<Resume, 'title' | 'sections'>> | null>(jsonPart, null);
    if (parsed) resumeUpdate = parsed;
    text = reply.trim();
  } else if (colonIdx !== -1) {
    const reply = text.slice(0, colonIdx);
    const jsonPart = text.slice(colonIdx + 'RESUME_UPDATE:'.length);
    const parsed = safeJsonParse<Partial<Pick<Resume, 'title' | 'sections'>> | null>(jsonPart, null);
    if (parsed) resumeUpdate = parsed;
    text = reply.trim();
  } else {
    // No marker at all — some small/weak models skip the instructed
    // "RESUME_UPDATE:"/"<RESUME_UPDATE>" wrapper entirely and just return
    // the raw resume JSON as the whole message (optionally with a short
    // preamble before it). Without this fallback that raw JSON blob would
    // otherwise be shown verbatim as the chat reply, and no update would
    // ever reach the preview. Only trust it if it actually looks like a
    // resume payload (has a "title" or "sections" key) to avoid mistaking
    // an unrelated "{" in normal prose for structured data.
    const braceIdx = text.indexOf('{');
    if (braceIdx !== -1) {
      const candidate = safeJsonParse<Partial<Pick<Resume, 'title' | 'sections'>> | null>(
        text.slice(braceIdx),
        null,
      );
      if (candidate && typeof candidate === 'object' && (candidate.title || candidate.sections)) {
        resumeUpdate = candidate;
        text = text.slice(0, braceIdx).trim();
      }
    }
  }

  // If the entire message was consumed as structured data, there's nothing
  // left to show the user — give them a short human-readable acknowledgement
  // instead of an empty chat bubble.
  if (!text.trim() && resumeUpdate) {
    text = "Got it — I've updated your resume with that.";
  }

  return { reply: text.trim(), resumeUpdate, suggestions };
}
