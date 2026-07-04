import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Resume } from '@careerforge/schema';
import { requestText } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface ResumePreviewProps {
  resume: Resume;
  scale?: number;
  className?: string;
}

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

export function ResumePreview({ resume, scale = 0.5, className = '' }: ResumePreviewProps) {
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

  useEffect(() => {
    // Wait for auth to resolve before trying to render. requestText also
    // retries once via the refresh cookie on a 401 mid-session, so this
    // guard only matters for the very first render before auth resolves.
    if (status !== 'authenticated') return;

    let cancelled = false;
    setRenderState('loading');
    // Stateless render: posts the current in-memory draft (title/theme/
    // sections) straight to the template engine — no DB id required, so
    // this works identically for a saved resume, an unsaved draft, or the
    // sample resume shown before any real data exists.
    requestText('/resumes/preview-render', {
      method: 'POST',
      body: { title: resume.title, theme: resume.theme, sections: resume.sections },
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
  }, [resume.title, resume.theme.templateId, resume.theme.accentColor, resume.sections, status]);

  const containerStyle: CSSProperties = { width: A4_WIDTH_PX * scale, height: A4_HEIGHT_PX * scale, overflow: 'hidden', flexShrink: 0, position: 'relative' };
  const iframeStyle: CSSProperties = { width: A4_WIDTH_PX, height: A4_HEIGHT_PX, border: 'none', transformOrigin: 'top left', transform: `scale(${scale})`, pointerEvents: 'none' };

  return (
    <div style={containerStyle} className={`bg-white shadow-lg rounded-sm ${className}`}>
      {/* sandbox="" (no flags) is safe because the preview HTML is pure HTML+CSS —
          the templates contain no <script> tags. Combining allow-scripts with
          allow-same-origin is explicitly forbidden as it lets the iframe escape
          its sandbox by removing the sandbox attribute on itself. */}
      <iframe ref={iframeRef} title="Resume preview" sandbox="" style={iframeStyle} aria-label="Live resume preview" />
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