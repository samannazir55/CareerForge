import React, { useState, useEffect } from 'react';
import Mustache from 'mustache';
import { ZoomIn, ZoomOut, Download, FileText, Loader2 } from 'lucide-react';
import { templateApi, cvApi } from '../../services/api';
import { Button } from '../ui/Button';
import type { CVData, BackendTemplate } from '../../types';

interface CVPreviewProps {
  data: CVData;
  activeTemplateId: string;
  cvId: number | null;
  onAutoSave: () => Promise<number | null>;
}

const stripHash = (color: string): string => String(color || '333333').replace(/#/g, '');

export function CVPreview({ data, activeTemplateId, cvId, onAutoSave }: CVPreviewProps) {
  const [template, setTemplate] = useState<BackendTemplate | null>(null);
  const [scale, setScale] = useState(0.85);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'docx' | null>(null);

  // Load template when ID changes
  useEffect(() => {
    if (!activeTemplateId) return;
    templateApi.get(activeTemplateId).then(setTemplate).catch(console.warn);
  }, [activeTemplateId]);

  // Build Mustache data object
  const pData = {
    ...data,
    full_name: data.fullName || 'Your Name',
    job_title: data.jobTitle || 'Job Title',
    email: data.email || '',
    phone: data.phone || '',
    location: data.location || '',
    full_name_initials: (data.fullName || 'YN')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join(''),
    summary: data.summary || '',
    experience: (data.experience || '').replace(/\n/g, '<br/>'),
    education: (data.education || '').replace(/\n/g, '<br/>'),
    skills: Array.isArray(data.skills)
      ? data.skills
      : (data.skills || '').split(',').map((s) => s.trim()).filter(Boolean),
    hobbies: (data.hobbies || '').split(',').map((s) => s.trim()).filter(Boolean),
    languages: (data.languages || '').split(',').map((s) => s.trim()).filter(Boolean),
    certifications: (data.certifications || '').split(',').map((s) => s.trim()).filter(Boolean),
    accent_color: stripHash(data.accentColor || '#2c3e50'),
    text_color: stripHash(data.textColor || '#333333'),
    font_family: data.fontFamily || 'sans-serif',
    profile_image: data.profileImage || '',
  };

  let htmlContent = '';
  let scopedCss = '';

  if (template?.html_content) {
    try {
      htmlContent = Mustache.render(template.html_content, pData);

      let templateCss = template.css_styles || '';
      templateCss = templateCss.replace(/:(\s*){{accent_color}}/g, ': #{{accent_color}}');
      templateCss = templateCss.replace(/:(\s*){{text_color}}/g, ': #{{text_color}}');
      const renderedCss = Mustache.render(templateCss, pData);

      // --- DYNAMIC CUSTOM FIELDS INJECTION (Live Preview) ---
      if (data.customFields && data.customFields.length > 0) {
        let customHtml = '';
        data.customFields.forEach(field => {
          if (!field.label || !field.value) return;
          const formattedValue = field.value.replace(/\n/g, '<br/>');
          
          if (activeTemplateId === 'classic') {
            customHtml += `
              <h3 style="background:#f0f0f0; padding:5px 10px; text-transform:uppercase; font-size:14px; font-weight:bold; border-left:5px solid #333; margin-top:20px;">${field.label}</h3>
              <div class="content" style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">${formattedValue}</div>
            `;
          } else {
            // Modern / Other layouts
            customHtml += `
              <div class="section" style="margin-top:20px;">
                <h2 style="color: #${pData.accent_color}; border-bottom: 2px solid #${pData.accent_color}; padding-bottom: 5px; text-transform: uppercase; margin-top: 0;">${field.label}</h2>
                <div class="text" style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">${formattedValue}</div>
              </div>
            `;
          }
        });

        // Inject custom HTML directly into the template structures
        if (activeTemplateId === 'classic' && htmlContent.includes("</div>")) {
          const lastDivIdx = htmlContent.lastIndexOf("</div>");
          htmlContent = htmlContent.substring(0, lastDivIdx) + customHtml + htmlContent.substring(lastDivIdx);
        } else if (htmlContent.includes("main-content")) {
          const startIdx = htmlContent.indexOf("main-content");
          const remainingHtml = htmlContent.substring(startIdx);
          const closingDivIdx = remainingHtml.indexOf("</div>");
          if (closingDivIdx !== -1) {
            const absoluteClosingIdx = startIdx + closingDivIdx;
            htmlContent = htmlContent.substring(0, absoluteClosingIdx) + customHtml + htmlContent.substring(absoluteClosingIdx);
          } else {
            htmlContent += customHtml;
          }
        } else {
          htmlContent += customHtml;
        }
      }

      scopedCss = `
        #cv-preview-iso {
          --primary: #${pData.accent_color};
          --text-main: #${pData.text_color};
          --font-main: ${pData.font_family};
          font-family: var(--font-main);
          color: var(--text-main);
          width: 100%;
          background: white;
          position: relative;
        }
        ${renderedCss}
      `;
    } catch (e) {
      console.error('Template render error:', e);
    }
  }

  const handleDownload = async (format: 'pdf' | 'docx') => {
    setIsDownloading(true);
    setDownloadFormat(format);
    try {
      let id = cvId;
      if (onAutoSave) {
        const savedId = await onAutoSave();
        if (savedId) id = savedId;
      }

      if (!id) {
        alert('Could not save CV. Please try again.');
        return;
      }

      const blob = await cvApi.export(id, format);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `${data.fullName || 'resume'}.${format === 'pdf' ? 'pdf' : 'docx'}`
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert('Download failed. Please try again.');
    } finally {
      setIsDownloading(false);
      setDownloadFormat(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Toolbar */}
      <div className="flex-none h-14 px-4 border-b border-border flex items-center justify-between glass-panel z-10">
        {/* Zoom controls */}
        <div className="flex items-center gap-1.5 bg-card p-1 rounded-xl border border-border shadow-sm">
          <button
            onClick={() => setScale((s) => Math.max(0.3, s - 0.1))}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-medium w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(1.5, s + 0.1))}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        {/* Download buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload('pdf')}
            disabled={isDownloading}
            className="gap-1.5 text-xs"
          >
            {isDownloading && downloadFormat === 'pdf' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload('docx')}
            disabled={isDownloading}
            className="gap-1.5 text-xs"
          >
            {isDownloading && downloadFormat === 'docx' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileText size={14} />
            )}
            DOCX
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-6 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:20px_20px]">
        {template ? (
          <div
            className="bg-white shadow-2xl shadow-black/10 origin-top transition-transform duration-300"
            style={{
              width: '794px',
              minHeight: '1123px',
              transform: `scale(${scale})`,
            }}
          >
            <div id="cv-preview-iso">
              <style>{scopedCss}</style>
              <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 size={24} className="animate-spin" />
            <p className="text-sm">Loading template...</p>
          </div>
        )}
      </div>
    </div>
  );
}
