import { useEffect, useRef, type CSSProperties } from 'react';
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

  useEffect(() => {
    // Wait for auth to resolve before trying to render. requestText also
    // retries once via the refresh cookie on a 401 mid-session, so this
    // guard only matters for the very first render before auth resolves.
    if (status !== 'authenticated') return;

    let cancelled = false;
    // Stateless render: posts the current in-memory draft (title/theme/
    // sections) straight to the template engine — no DB id required, so
    // this works identically for a saved resume, an unsaved draft, or the
    // sample resume shown before any real data exists.
    requestText('/resumes/preview-render', {
      method: 'POST',
      body: { title: resume.title, theme: resume.theme, sections: resume.sections },
    })
      .then((html) => {
        if (!cancelled && iframeRef.current) iframeRef.current.srcdoc = html;
      })
      .catch((err) => {
        // Not surfaced to the user (a broken preview shouldn't block chatting),
        // but logged so this class of bug — a validation rejection, a network
        // failure, etc. — is visible in devtools instead of just an eternally
        // stale iframe with no clue why.
        console.error('Resume preview render failed:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [resume.title, resume.theme.templateId, resume.theme.accentColor, resume.sections, status]);

  const containerStyle: CSSProperties = { width: A4_WIDTH_PX * scale, height: A4_HEIGHT_PX * scale, overflow: 'hidden', flexShrink: 0 };
  const iframeStyle: CSSProperties = { width: A4_WIDTH_PX, height: A4_HEIGHT_PX, border: 'none', transformOrigin: 'top left', transform: `scale(${scale})`, pointerEvents: 'none' };

  return (
    <div style={containerStyle} className={`bg-white shadow-lg rounded-sm ${className}`}>
      {/* sandbox="" (no flags) is safe because the preview HTML is pure HTML+CSS —
          the templates contain no <script> tags. Combining allow-scripts with
          allow-same-origin is explicitly forbidden as it lets the iframe escape
          its sandbox by removing the sandbox attribute on itself. */}
      <iframe ref={iframeRef} title="Resume preview" sandbox="" style={iframeStyle} aria-label="Live resume preview" />
    </div>
  );
}