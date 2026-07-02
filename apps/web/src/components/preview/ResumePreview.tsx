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
 * Renders the resume inside a sandboxed iframe by fetching the rendered
 * HTML from /api/resumes/:id/preview.
 *
 * The old "id === 'preview'" gate has been removed. AIChatBuilderPage now
 * always creates a real DB resume on mount, so resume.id is always a
 * real UUID by the time this component renders. The gate was the direct
 * cause of the preview never showing anything in the chat builder.
 *
 * sandbox="allow-same-origin" only — templates have no scripts, only
 * <style> tags, so allow-scripts was unnecessary and caused browser warnings.
 */
export function ResumePreview({ resume, scale = 0.5, className = '' }: ResumePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!resume.id) return;

    const token = getAccessToken();
    if (!token) return;

    setIsLoading(true);

    fetch(`/api/resumes/${resume.id}/preview`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.text();
      })
      .then((html) => {
        if (iframeRef.current) {
          iframeRef.current.srcdoc = html;
          setIsLoading(false);
        }
      })
      .catch(() => setIsLoading(false));
  }, [
    resume.id,
    resume.theme?.templateId,
    resume.theme?.accentColor,
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
      {/* Skeleton shown while first fetch completes */}
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
