import type { Resume, Section } from '@careerforge/schema';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from 'docx';
import type { TemplateRenderer } from './types';
import {
  escapeHtml,
  richTextToHtml,
  formatDate,
  formatDateRange,
  getString,
  renderEntryFieldsGeneric,
  getPersonalInfo,
  getBodySections,
} from './helpers';

// ---------------------------------------------------------------------------
// Classic template — left sidebar for contact/skills, main column for body
// ---------------------------------------------------------------------------

const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 0; }
  body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; line-height: 1.5; color: #1a1a1a; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .cf-page { display: grid; grid-template-columns: 68mm 1fr; min-height: 297mm; max-width: 210mm; margin: 0 auto; }
  .cf-sidebar { background: #1e1e2e; color: #e8e8f0; padding: 20pt 14pt; }
  .cf-sidebar h1 { font-size: 16pt; font-weight: 700; color: #fff; line-height: 1.2; margin-bottom: 3pt; }
  .cf-sidebar .cf-job-title { font-size: 9pt; color: var(--accent, #818cf8); margin-bottom: 16pt; }
  .cf-sidebar-section { margin-bottom: 14pt; break-inside: avoid; }
  .cf-sidebar-section-title { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1pt; color: var(--accent, #818cf8); border-bottom: 1pt solid var(--accent, #818cf8); padding-bottom: 3pt; margin-bottom: 8pt; }
  .cf-contact-item { font-size: 8.5pt; color: #c8c8d8; margin-bottom: 3pt; word-break: break-all; }
  .cf-skill-item { font-size: 8.5pt; color: #c8c8d8; margin-bottom: 3pt; padding-left: 8pt; position: relative; }
  .cf-skill-item::before { content: '–'; position: absolute; left: 0; color: var(--accent, #818cf8); }
  .cf-main { padding: 20pt 18pt; }
  .cf-section { margin-bottom: 14pt; break-inside: avoid-page; }
  .cf-section-title { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1pt; color: #1e1e2e; border-bottom: 1.5pt solid #1e1e2e; padding-bottom: 3pt; margin-bottom: 10pt; }
  .cf-entry { margin-bottom: 9pt; break-inside: avoid; }
  .cf-entry-header { display: flex; justify-content: space-between; align-items: baseline; }
  .cf-entry-primary { font-weight: 600; font-size: 10.5pt; }
  .cf-entry-secondary { font-size: 9.5pt; color: #555; margin-top: 1pt; }
  .cf-entry-date { font-size: 8.5pt; color: #777; white-space: nowrap; margin-left: 8pt; }
  .cf-entry p { font-size: 9.5pt; color: #333; margin-top: 2pt; }
  .cf-field { font-size: 9.5pt; margin-bottom: 3pt; }
  .cf-field-label { font-weight: 600; }
  .cf-field--richtext p { margin-top: 2pt; }
  a { color: var(--accent, #818cf8); text-decoration: none; }
`;

function renderSidebarSection(title: string, content: string): string {
  return `<div class="cf-sidebar-section"><div class="cf-sidebar-section-title">${escapeHtml(title)}</div>${content}</div>`;
}

function renderMainSection(section: Section): string {
  const entries = section.entries;
  if (!entries.length) return '';

  let content = '';

  switch (section.type) {
    case 'experience':
      content = entries.map((e) => {
        const title = getString(e, 'title');
        const company = getString(e, 'company');
        const location = getString(e, 'location');
        const dateRange = formatDateRange(e.values.startDate, e.values.endDate);
        const description = getString(e, 'description');
        const secondary = [company, location].filter(Boolean).join(', ');
        return `<div class="cf-entry">
          <div class="cf-entry-header">
            <div class="cf-entry-primary">${escapeHtml(title)}</div>
            ${dateRange ? `<div class="cf-entry-date">${escapeHtml(dateRange)}</div>` : ''}
          </div>
          ${secondary ? `<div class="cf-entry-secondary">${escapeHtml(secondary)}</div>` : ''}
          ${description ? richTextToHtml(description) : ''}
        </div>`;
      }).join('');
      break;

    case 'education':
      content = entries.map((e) => {
        const degree = getString(e, 'degree');
        const school = getString(e, 'school');
        const dateRange = formatDateRange(e.values.startDate, e.values.endDate);
        return `<div class="cf-entry">
          <div class="cf-entry-header">
            <div class="cf-entry-primary">${escapeHtml(degree)}</div>
            ${dateRange ? `<div class="cf-entry-date">${escapeHtml(dateRange)}</div>` : ''}
          </div>
          ${school ? `<div class="cf-entry-secondary">${escapeHtml(school)}</div>` : ''}
        </div>`;
      }).join('');
      break;

    case 'certifications':
      content = entries.map((e) => {
        const name = getString(e, 'name');
        const issuer = getString(e, 'issuer');
        const date = formatDate(getString(e, 'date'));
        return `<div class="cf-entry">
          <div class="cf-entry-header">
            <div class="cf-entry-primary">${escapeHtml(name)}</div>
            ${date ? `<div class="cf-entry-date">${escapeHtml(date)}</div>` : ''}
          </div>
          ${issuer ? `<div class="cf-entry-secondary">${escapeHtml(issuer)}</div>` : ''}
        </div>`;
      }).join('');
      break;

    case 'projects':
      content = entries.map((e) => {
        const name = getString(e, 'name');
        const description = getString(e, 'description');
        const url = getString(e, 'url');
        return `<div class="cf-entry">
          <div class="cf-entry-primary">${escapeHtml(name)}${url ? ` <a href="${escapeHtml(url)}" style="font-size:8.5pt;font-weight:400">${escapeHtml(url)}</a>` : ''}</div>
          ${description ? richTextToHtml(description) : ''}
        </div>`;
      }).join('');
      break;

    default:
      content = entries.map((e) => `<div class="cf-entry">${renderEntryFieldsGeneric(e, section.fields)}</div>`).join('');
      break;
  }

  return `<div class="cf-section"><div class="cf-section-title">${escapeHtml(section.title)}</div>${content}</div>`;
}

function renderHtml(resume: Resume): string {
  const info = getPersonalInfo(resume);
  const accent = resume.theme.accentColor || '#818cf8';
  const allSections = getBodySections(resume);

  // Sidebar: skills, languages, references  |  Main: everything else
  const sidebarTypes = new Set(['skills', 'languages', 'references']);
  const sidebarSections = allSections.filter((s) => sidebarTypes.has(s.type) && s.entries.length);
  const mainSections = allSections.filter((s) => !sidebarTypes.has(s.type));

  const contactItems = [
    info.email && `<div class="cf-contact-item">${escapeHtml(info.email)}</div>`,
    info.phone && `<div class="cf-contact-item">${escapeHtml(info.phone)}</div>`,
    info.location && `<div class="cf-contact-item">${escapeHtml(info.location)}</div>`,
    info.linkedin && `<div class="cf-contact-item">${escapeHtml(info.linkedin)}</div>`,
    info.website && `<div class="cf-contact-item">${escapeHtml(info.website)}</div>`,
  ].filter(Boolean).join('');

  const sidebarHtml = [
    contactItems ? renderSidebarSection('Contact', contactItems) : '',
    ...sidebarSections.map((s) => {
      let content = '';
      if (s.type === 'skills') {
        content = s.entries.map((e) => `<div class="cf-skill-item">${escapeHtml(getString(e, 'name'))}</div>`).join('');
      } else if (s.type === 'languages') {
        content = s.entries.map((e) => {
          const name = getString(e, 'name');
          const prof = getString(e, 'proficiency');
          return `<div class="cf-skill-item">${escapeHtml(name)}${prof ? ` <span style="opacity:.7">(${escapeHtml(prof)})</span>` : ''}</div>`;
        }).join('');
      } else {
        content = s.entries.map((e) => `<div class="cf-skill-item">${escapeHtml(getString(e, 'name') || renderEntryFieldsGeneric(e, s.fields))}</div>`).join('');
      }
      return renderSidebarSection(s.title, content);
    }),
  ].join('');

  const accentStyle = `--accent: ${accent};`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeHtml(info.fullName)}</title>
  <style>${PRINT_CSS}</style>
</head>
<body style="${accentStyle}">
  <div class="cf-page">
    <div class="cf-sidebar">
      <h1>${escapeHtml(info.fullName)}</h1>
      ${info.jobTitle ? `<div class="cf-job-title">${escapeHtml(info.jobTitle)}</div>` : ''}
      ${sidebarHtml}
    </div>
    <div class="cf-main">
      ${mainSections.map(renderMainSection).join('')}
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// DOCX builder
// ---------------------------------------------------------------------------

async function buildDocx(resume: Resume): Promise<Buffer> {
  const info = getPersonalInfo(resume);
  const bodySections = getBodySections(resume);

  const children: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: info.fullName, bold: true, size: 44 })] }),
    ...(info.jobTitle ? [new Paragraph({ children: [new TextRun({ text: info.jobTitle, size: 22, color: '555555' })] })] : []),
    new Paragraph({
      children: [new TextRun({ text: [info.email, info.phone, info.location].filter(Boolean).join('  ·  '), size: 18, color: '777777' })],
    }),
    new Paragraph({ text: '' }),
  ];

  for (const section of bodySections) {
    if (!section.entries.length) continue;
    children.push(
      new Paragraph({
        text: section.title.toUpperCase(),
        heading: HeadingLevel.HEADING_2,
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1E1E2E' } },
      }),
    );
    for (const entry of section.entries) {
      switch (section.type) {
        case 'experience': {
          children.push(new Paragraph({ children: [new TextRun({ text: getString(entry, 'title'), bold: true, size: 22 }), ...(getString(entry, 'company') ? [new TextRun({ text: `  ${getString(entry, 'company')}`, size: 20, color: '555555' })] : []), ...(formatDateRange(entry.values.startDate, entry.values.endDate) ? [new TextRun({ text: `  ${formatDateRange(entry.values.startDate, entry.values.endDate)}`, size: 18, color: '777777' })] : [])] }));
          const desc = getString(entry, 'description');
          if (desc) desc.split('\n').filter(Boolean).forEach((l) => children.push(new Paragraph({ text: l, bullet: { level: 0 } })));
          break;
        }
        case 'education': {
          children.push(new Paragraph({ children: [new TextRun({ text: getString(entry, 'degree'), bold: true, size: 22 }), ...(getString(entry, 'school') ? [new TextRun({ text: `  ${getString(entry, 'school')}`, size: 20, color: '555555' })] : []), ...(formatDateRange(entry.values.startDate, entry.values.endDate) ? [new TextRun({ text: `  ${formatDateRange(entry.values.startDate, entry.values.endDate)}`, size: 18, color: '777777' })] : [])] }));
          break;
        }
        case 'skills': {
          children.push(new Paragraph({ text: `• ${getString(entry, 'name')}`, indent: { left: 360 } }));
          break;
        }
        default: {
          for (const field of section.fields) {
            const val = entry.values[field.key];
            if (!val) continue;
            children.push(new Paragraph({ children: [new TextRun({ text: `${field.label}: `, bold: true }), new TextRun({ text: Array.isArray(val) ? val.join(', ') : String(val) })] }));
          }
          break;
        }
      }
      children.push(new Paragraph({ text: '' }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}

export const classicTemplate: TemplateRenderer = {
  id: 'classic',
  name: 'Classic',
  category: 'free',
  previewClass: 'template-classic',
  renderHtml,
  buildDocx,
};
