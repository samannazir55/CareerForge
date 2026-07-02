import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Resume } from '@careerforge/schema';
import { getAccessToken } from '../../lib/api';

interface ResumePreviewProps {
  resume: Resume;
  scale?: number;
  className?: string;
}

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

/**
 * Renders the resume HTML in a sandboxed iframe by fetching from the
 * /api/resumes/:id/preview endpoint.
 *
 * Previous bug: the component showed "Start typing to see preview"
 * whenever resume.id === 'preview'. In the AI chat builder, the resume
 * object always had id='preview' because the UI was creating a local
 * EMPTY_RESUME placeholder and only spreading title/sections from AI
 * updates onto it — never updating the id. The fix is in AIChatBuilderPage:
 * a real DB resume is created immediately on mount, so by the time the
 * user sends their first message, resume.id is always a real UUID.
 *
 * This component no longer has the 'preview' gate. It shows a loading
 * skeleton until the first successful fetch, then renders the HTML.
 * If the resume has no id, it shows a neutral placeholder.
 */
export function ResumePreview({ resume, scale = 0.5, className = '' }: ResumePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // No id — blank state (should not happen in normal usage after the
    // AIChatBuilderPage fix, but kept as a safe fallback)
    if (!resume.id) {
      setIsLoading(false);
      iframe.srcdoc = `<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#aaa;font-size:13px;">No resume loaded</body></html>`;
      return;
    }

    const token = getAccessToken();
    if (!token) return;

    setIsLoading(true);

    fetch(`/api/resumes/${resume.id}/preview`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Preview fetch failed: ${res.status}`);
        return res.text();
      })
      .then((html) => {
        if (iframeRef.current) {
          iframeRef.current.srcdoc = html;
          setIsLoading(false);
        }
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [
    resume.id,
    resume.theme?.templateId,
    resume.theme?.accentColor,
    // Stringify sections so the effect re-runs when content changes.
    // JSON.stringify is intentional — we need deep equality here, not
    // reference equality, since the sections array is recreated on
    // every AI update even if the content is the same.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(resume.sections),
    resume.title,
  ]);

  const containerStyle: CSSProperties = {
    width: A4_WIDTH_PX * scale,
    height: A4_HEIGHT_PX * scale,
    overflow: 'hidden',
    flexShrink: 0,
    position: 'relative',
  };

  const iframeStyle: CSSProperties = {
    width: A4_WIDTH_PX,
    height: A4_HEIGHT_PX,
    border: 'none',
    transformOrigin: 'top left',
    transform: `scale(${scale})`,
    pointerEvents: 'none',
    display: isLoading ? 'none' : 'block',
  };

  return (
    <div
      style={containerStyle}
      className={`bg-white shadow-lg rounded-sm ${className}`}
    >
      {/* Loading skeleton — shown while the first fetch completes */}
      {isLoading && (
        <div
          style={{ width: '100%', height: '100%' }}
          className="flex flex-col gap-3 p-6 animate-pulse"
        >
          <div className="h-16 bg-indigo-100 rounded" />
          <div className="h-3 bg-gray-100 rounded w-3/4 mt-4" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
          <div className="h-3 bg-gray-100 rounded w-2/3 mt-6" />
          <div className="h-3 bg-gray-100 rounded" />
          <div className="h-3 bg-gray-100 rounded w-5/6" />
          <div className="h-3 bg-gray-100 rounded w-3/4 mt-6" />
          <div className="h-3 bg-gray-100 rounded" />
          <div className="h-3 bg-gray-100 rounded w-4/5" />
        </div>
      )}

      <iframe
        ref={iframeRef}
        title="Resume preview"
        sandbox="allow-same-origin"
        style={iframeStyle}
        aria-label="Live resume preview"
      />
    </div>
  );
}
