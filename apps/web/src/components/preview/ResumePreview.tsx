import { useEffect, useRef, type CSSProperties } from 'react';
import type { Resume } from '@careerforge/schema';
import { getAccessToken } from '../../lib/api';

interface ResumePreviewProps {
  resume: Resume;
  scale?: number;
  className?: string;
}

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

export function ResumePreview({ resume, scale = 0.5, className = '' }: ResumePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!resume.id || resume.id === 'preview') {
      if (iframeRef.current) {
        iframeRef.current.srcdoc = `<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#888;font-size:14px;">Start typing to see your resume preview</body></html>`;
      }
      return;
    }
    const token = getAccessToken();
    if (!token) return;
    fetch(`/api/resumes/${resume.id}/preview`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    })
      .then((res) => res.text())
      .then((html) => { if (iframeRef.current) iframeRef.current.srcdoc = html; })
      .catch(() => undefined);
  }, [resume.id, resume.theme.templateId, resume.theme.accentColor, resume.sections, resume.title]);

  const containerStyle: CSSProperties = { width: A4_WIDTH_PX * scale, height: A4_HEIGHT_PX * scale, overflow: 'hidden', flexShrink: 0 };
  const iframeStyle: CSSProperties = { width: A4_WIDTH_PX, height: A4_HEIGHT_PX, border: 'none', transformOrigin: 'top left', transform: `scale(${scale})`, pointerEvents: 'none' };

  return (
    <div style={containerStyle} className={`bg-white shadow-lg rounded-sm ${className}`}>
      <iframe ref={iframeRef} title="Resume preview" sandbox="allow-scripts allow-same-origin" style={iframeStyle} aria-label="Live resume preview" />
    </div>
  );
}
