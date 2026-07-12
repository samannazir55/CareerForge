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
  getSummaryText,
  getSummaryRef,
  cfField,
  cfEntry,
  cfSectionTitle,
  CF_TITLE_SECTION_ID,
  CF_TITLE_ENTRY_ID,
  CF_TITLE_FIELD_KEY,
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
  .cf-sidebar h1 .cf-name-first { color: #fff; }
  .cf-sidebar h1 .cf-name-last { color: var(--accent, #818cf8); margin-left: 0.28em; }
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

function renderSidebarSection(sectionId: string | null, title: string, content: string): string {
  const titleHtml = sectionId ? cfSectionTitle(sectionId, escapeHtml(title), 'cf-sidebar-section-title') : `<div class="cf-sidebar-section-title">${escapeHtml(title)}</div>`;
  return `<div class="cf-sidebar-section">${titleHtml}${content}</div>`;
}

function renderMainSection(section: Section): string {
  const entries = section.entries;
  if (!entries.length) return '';

  let content = '';
  const sid = section.id;

  switch (section.type) {
    case 'experience':
      content = entries.map((e) => {
        const title = getString(e, 'title');
        const company = getString(e, 'company');
        const location = getString(e, 'location');
        const dateRange = formatDateRange(e.values.startDate, e.values.endDate);
        const description = getString(e, 'description');
        const secondary = [company, location].filter(Boolean).join(', ');
        return cfEntry(
          sid,
          e.id,
          `
          <div class="cf-entry-header">
            <div class="cf-entry-primary">${cfField(sid, e.id, 'title', escapeHtml(title))}</div>
            ${dateRange ? `<div class="cf-entry-date">${escapeHtml(dateRange)}</div>` : ''}
          </div>
          ${secondary ? `<div class="cf-entry-secondary">${escapeHtml(secondary)}</div>` : ''}
          ${description ? cfField(sid, e.id, 'description', richTextToHtml(description)) : ''}`,
          'cf-entry',
        );
      }).join('');
      break;

    case 'education':
      content = entries.map((e) => {
        const degree = getString(e, 'degree');
        const school = getString(e, 'school');
        const dateRange = formatDateRange(e.values.startDate, e.values.endDate);
        return cfEntry(
          sid,
          e.id,
          `
          <div class="cf-entry-header">
            <div class="cf-entry-primary">${cfField(sid, e.id, 'degree', escapeHtml(degree))}</div>
            ${dateRange ? `<div class="cf-entry-date">${escapeHtml(dateRange)}</div>` : ''}
          </div>
          ${school ? `<div class="cf-entry-secondary">${escapeHtml(school)}</div>` : ''}`,
          'cf-entry',
        );
      }).join('');
      break;

    case 'certifications':
      content = entries.map((e) => {
        const name = getString(e, 'name');
        const issuer = getString(e, 'issuer');
        const date = formatDate(getString(e, 'date'));
        return cfEntry(
          sid,
          e.id,
          `
          <div class="cf-entry-header">
            <div class="cf-entry-primary">${cfField(sid, e.id, 'name', escapeHtml(name))}</div>
            ${date ? `<div class="cf-entry-date">${escapeHtml(date)}</div>` : ''}
          </div>
          ${issuer ? `<div class="cf-entry-secondary">${escapeHtml(issuer)}</div>` : ''}`,
          'cf-entry',
        );
      }).join('');
      break;

    case 'projects':
      content = entries.map((e) => {
        const name = getString(e, 'name');
        const description = getString(e, 'description');
        const url = getString(e, 'url');
        return cfEntry(
          sid,
          e.id,
          `
          <div class="cf-entry-primary">${cfField(sid, e.id, 'name', escapeHtml(name))}${url ? ` <a href="${escapeHtml(url)}" style="font-size:8.5pt;font-weight:400">${escapeHtml(url)}</a>` : ''}</div>
          ${description ? cfField(sid, e.id, 'description', richTextToHtml(description)) : ''}`,
          'cf-entry',
        );
      }).join('');
      break;

    default:
      content = entries.map((e) => cfEntry(sid, e.id, renderEntryFieldsGeneric(sid, e, section.fields), 'cf-entry')).join('');
      break;
  }

  return `<div class="cf-section">${cfSectionTitle(sid, escapeHtml(section.title))}${content}</div>`;
}

function renderHtml(resume: Resume): string {
  const info = getPersonalInfo(resume);
  const accent = resume.theme.accentColor || '#818cf8';
  const allSections = getBodySections(resume);
  const summaryText = getSummaryText(resume);
  const summaryRef = getSummaryRef(resume);

  const wrapHeaderField = (fieldKey: string, html: string) =>
    summaryRef ? cfField(summaryRef.sectionId, summaryRef.entryId, fieldKey, html) : html;

  // Sidebar: skills, languages, references  |  Main: everything else
  const sidebarTypes = new Set(['skills', 'languages', 'references']);
  const sidebarSections = allSections.filter((s) => sidebarTypes.has(s.type) && s.entries.length);
  const mainSections = allSections.filter((s) => !sidebarTypes.has(s.type));

  const contactItems = [
    info.email && { key: 'email', value: info.email },
    info.phone && { key: 'phone', value: info.phone },
    info.location && { key: 'location', value: info.location },
    info.linkedin && { key: 'linkedin', value: info.linkedin },
    info.website && { key: 'website', value: info.website },
  ]
    .filter((p): p is { key: string; value: string } => Boolean(p))
    .map((p) => `<div class="cf-contact-item">${wrapHeaderField(p.key, escapeHtml(p.value))}</div>`)
    .join('');

  const sidebarHtml = [
    contactItems ? renderSidebarSection(null, 'Contact', contactItems) : '',
    ...sidebarSections.map((s) => {
      let content = '';
      if (s.type === 'skills') {
        content = s.entries.map((e) => cfEntry(s.id, e.id, `<div class="cf-skill-item">${cfField(s.id, e.id, 'name', escapeHtml(getString(e, 'name')))}</div>`, '')).join('');
      } else if (s.type === 'languages') {
        content = s.entries.map((e) => {
          const name = getString(e, 'name');
          const prof = getString(e, 'proficiency');
          return cfEntry(
            s.id,
            e.id,
            `<div class="cf-skill-item">${cfField(s.id, e.id, 'name', escapeHtml(name))}${prof ? ` <span style="opacity:.7">(${escapeHtml(prof)})</span>` : ''}</div>`,
            '',
          );
        }).join('');
      } else {
        content = s.entries
          .map((e) => cfEntry(s.id, e.id, `<div class="cf-skill-item">${getString(e, 'name') ? cfField(s.id, e.id, 'name', escapeHtml(getString(e, 'name'))) : renderEntryFieldsGeneric(s.id, e, s.fields)}</div>`, ''))
          .join('');
      }
      return renderSidebarSection(s.id, s.title, content);
    }),
  ].join('');

  const accentStyle = `--accent: ${accent};`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeHtml(info.fullName || `${info.firstName} ${info.lastName}`.trim())}</title>
  <style>${PRINT_CSS}</style>
</head>
<body style="${accentStyle}">
  <div class="cf-page">
    <div class="cf-sidebar">
      <h1>${
        info.firstName || info.lastName
          ? `${wrapHeaderField('firstName', `<span class="cf-name-first">${escapeHtml(info.firstName)}</span>`)}${
              info.lastName ? ' ' : ''
            }${wrapHeaderField('lastName', `<span class="cf-name-last">${escapeHtml(info.lastName)}</span>`)}`
          : cfField(CF_TITLE_SECTION_ID, CF_TITLE_ENTRY_ID, CF_TITLE_FIELD_KEY, escapeHtml(info.fullName))
      }</h1>
      ${info.jobTitle ? `<div class="cf-job-title">${wrapHeaderField('jobTitle', escapeHtml(info.jobTitle))}</div>` : ''}
      ${sidebarHtml}
    </div>
    <div class="cf-main">
      ${summaryText ? `<div class="cf-section"><div class="cf-section-title">Summary</div>${wrapHeaderField('text', richTextToHtml(summaryText))}</div>` : ''}
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
  const summaryText = getSummaryText(resume);

  const children: Paragraph[] = [
    new Paragraph({
      children:
        info.firstName || info.lastName
          ? [
              new TextRun({ text: info.firstName, bold: true, size: 44 }),
              ...(info.lastName ? [new TextRun({ text: ` ${info.lastName}`, bold: true, size: 44, color: '4F46E5' })] : []),
            ]
          : [new TextRun({ text: info.fullName, bold: true, size: 44 })],
    }),
    ...(info.jobTitle ? [new Paragraph({ children: [new TextRun({ text: info.jobTitle, size: 22, color: '555555' })] })] : []),
    new Paragraph({
      children: [new TextRun({ text: [info.email, info.phone, info.location].filter(Boolean).join('  ·  '), size: 18, color: '777777' })],
    }),
    new Paragraph({ text: '' }),
  ];

  if (summaryText) {
    children.push(
      new Paragraph({
        text: 'SUMMARY',
        heading: HeadingLevel.HEADING_2,
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1E1E2E' } },
      }),
    );
    summaryText.split('\n').filter(Boolean).forEach((line) => children.push(new Paragraph({ text: line })));
  }

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
  family: 'classic',
  previewClass: 'template-classic',
  renderHtml,
  buildDocx,
};