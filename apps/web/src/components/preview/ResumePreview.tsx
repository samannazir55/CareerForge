import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Resume } from '@careerforge/schema';
import { requestText } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

/** Shape of postMessage events the interactive preview's injected bootstrap
 * script sends (see apps/api/src/domain/resume/previewInteractivity.ts).
 * Kept in sync with that script's `post({...})` calls by hand — there's no
 * shared type between the two since one lives in a <script> string and the
 * other in this file's own bundle. */
export type ResumePreviewEditEvent =
  | { type: 'field-edit'; sectionId: string; entryId: string; field: string; value: string }
  | { type: 'delete-entry'; sectionId: string; entryId: string }
  | { type: 'delete-section'; sectionId: string };

interface ResumePreviewProps {
  resume: Resume;
  scale?: number;
  className?: string;
  /** Enables click-to-edit/click-to-delete directly on the rendered
   * preview (see previewInteractivity.ts). Off by default — the read-only
   * AI-chat-builder preview never sets this. */
  interactive?: boolean;
  /** Fired for every edit/delete the person makes directly on the preview.
   * Required when `interactive` is true. */
  onEdit?: (event: ResumePreviewEditEvent) => void;
}

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

export function ResumePreview({ resume, scale = 0.5, className = '', interactive = false, onEdit }: ResumePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // `status` is React state — including it in the dependency array means the
  // effect re-runs once the auth refresh resolves and the token is available,
  // even if the resume props haven't changed since mount.
  const { status } = useAuth();
  // Surfaces a failed/slow render instead of leaving a silently stale iframe
  // with no visible signal — previously a rejected preview-render call only
  // did console.error, so from the user's side a broken preview looked
  // identical to a correctly-rendered one that just hadn't changed.
  const [renderState, setRenderState] = useState<'idle' | 'loading' | 'error'>('idle');

  // Set right before onEdit() is called for a 'field-edit' message (see the
  // message handler below) and consumed once by the render effect. A text
  // edit's contenteditable already shows the new value inside the iframe —
  // by the time onEdit() round-trips through the parent's setSections/
  // setTitle and back down as new props, re-fetching a fresh render and
  // replacing the entire iframe document via srcdoc is pure waste, and a
  // full document replacement is a full reload: the iframe visibly blinks,
  // and if this happens while the user is still mid-edit elsewhere (e.g. a
  // second field, or this same field re-focused before the round trip
  // finishes) the reload can appear to "revert" whatever hadn't been
  // committed yet. Deletes are NOT suppressed here — removing a
  // section/entry isn't reflected locally by the injected script (it relies
  // entirely on the next render to actually drop the markup), so those must
  // still go through the normal fetch-and-replace path.
  const suppressNextRenderRef = useRef(false);

  useEffect(() => {
    // Wait for auth to resolve before trying to render. requestText also
    // retries once via the refresh cookie on a 401 mid-session, so this
    // guard only matters for the very first render before auth resolves.
    if (status !== 'authenticated') return;

    if (suppressNextRenderRef.current) {
      suppressNextRenderRef.current = false;
      return;
    }

    let cancelled = false;
    setRenderState('loading');
    // Stateless render: posts the current in-memory draft (title/theme/
    // sections) straight to the template engine — no DB id required, so
    // this works identically for a saved resume, an unsaved draft, or the
    // sample resume shown before any real data exists.
    requestText('/resumes/preview-render', {
      method: 'POST',
      body: { title: resume.title, theme: resume.theme, sections: resume.sections, interactive },
    })
      .then((html) => {
        if (cancelled) return;
        if (iframeRef.current) iframeRef.current.srcdoc = html;
        setRenderState('idle');
      })
      .catch((err) => {
        // Still logged for devtools, but no longer the only signal — the
        // banner below makes a broken preview visible without opening the
        // console, which is what made this class of bug hard to notice.
        console.error('Resume preview render failed:', err);
        if (!cancelled) setRenderState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [resume.title, resume.theme.templateId, resume.theme.accentColor, resume.theme.photoUrl, resume.sections, status, interactive]);

  // Wires up the interactive preview's postMessage channel. Only listens
  // for messages that both (a) come from this exact iframe (not some other
  // frame or a spoofed message from elsewhere on the page) and (b) match
  // one of the known event shapes — a compromised/buggy dynamic template
  // can at worst post garbage here, which this simply ignores rather than
  // trusting blindly (see the security note in previewInteractivity.ts).
  useEffect(() => {
    if (!interactive) return;

    function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== 'corvyx-preview') return;
      if (data.type === 'field-edit' && typeof data.sectionId === 'string' && typeof data.entryId === 'string' && typeof data.field === 'string' && typeof data.value === 'string') {
        suppressNextRenderRef.current = true;
        onEdit?.({ type: 'field-edit', sectionId: data.sectionId, entryId: data.entryId, field: data.field, value: data.value });
      } else if (data.type === 'delete-entry' && typeof data.sectionId === 'string' && typeof data.entryId === 'string') {
        onEdit?.({ type: 'delete-entry', sectionId: data.sectionId, entryId: data.entryId });
      } else if (data.type === 'delete-section' && typeof data.sectionId === 'string') {
        onEdit?.({ type: 'delete-section', sectionId: data.sectionId });
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [interactive, onEdit]);

  const containerStyle: CSSProperties = { width: A4_WIDTH_PX * scale, height: A4_HEIGHT_PX * scale, overflow: 'hidden', flexShrink: 0, position: 'relative' };
  const iframeStyle: CSSProperties = {
    width: A4_WIDTH_PX,
    height: A4_HEIGHT_PX,
    border: 'none',
    transformOrigin: 'top left',
    transform: `scale(${scale})`,
    pointerEvents: interactive ? 'auto' : 'none',
  };

  return (
    <div style={containerStyle} className={`bg-white shadow-lg rounded-sm ${className}`}>
      {/* Non-interactive preview: sandbox="" (no flags) is safe because the
          rendered HTML has no injected <script>. Interactive preview:
          sandbox="allow-scripts" ONLY — deliberately never combined with
          allow-same-origin, which would let the iframe (and therefore any
          admin/AI-authored dynamic template's markup) escape its isolation
          and reach this page's cookies/DOM. postMessage is the only
          channel across that boundary either way; see previewInteractivity.ts. */}
      <iframe
        ref={iframeRef}
        title="Resume preview"
        sandbox={interactive ? 'allow-scripts' : ''}
        style={iframeStyle}
        aria-label="Live resume preview"
      />
      {renderState === 'error' && (
        <div
          role="status"
          className="absolute bottom-0 left-0 right-0 text-center text-[11px] py-1 px-2 bg-amber-500/90 text-white"
        >
          Preview couldn't refresh — showing the last successful version
        </div>
      )}
    </div>
  );
}