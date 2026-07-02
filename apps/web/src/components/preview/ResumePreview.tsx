import { useEffect, useRef, type CSSProperties } from 'react';
import type { Resume } from '@careerforge/schema';
import { getAccessToken } from '../../lib/api';
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
    if (!resume.id || resume.id === 'preview') {
      if (iframeRef.current) {
        iframeRef.current.srcdoc = `<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#888;font-size:14px;">Start typing to see your resume preview</body></html>`;
      }
      return;
    }
    // Wait for auth to resolve before trying to fetch the preview. Without
    // this guard, getAccessToken() returns null on mount (the refresh is async)
    // and the fetch exits early — and never retries because getAccessToken is a
    // plain module variable that doesn't trigger React re-renders when it changes.
    if (status !== 'authenticated') return;
    const token = getAccessToken();
    if (!token) return;
    fetch(`/api/resumes/${resume.id}/preview`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    })
      .then((res) => res.text())
      .then((html) => { if (iframeRef.current) iframeRef.current.srcdoc = html; })
      .catch(() => undefined);
  // `status` added so the effect re-fires once auth confirms the token is ready.
  }, [resume.id, resume.theme.templateId, resume.theme.accentColor, resume.sections, resume.title, status]);

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