import type { Resume, Section } from '@careerforge/schema';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, ShadingType } from 'docx';
import type { TemplateRenderer } from './types';
import {
  escapeHtml,
  richTextToHtml,
  formatDate,
  formatDateRange,
  getString,
  getList,
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
// HTML renderer — used for both live preview and Puppeteer PDF generation
// ---------------------------------------------------------------------------

const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 14mm 16mm; }
  body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; line-height: 1.5; color: #1a1a1a; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .cf-page { max-width: 210mm; margin: 0 auto; padding: 0; }
  .cf-header { background: var(--accent, #4f46e5); color: white; padding: 20pt 24pt 16pt; margin-bottom: 0; }
  .cf-header h1 { font-size: 22pt; font-weight: 700; letter-spacing: -0.3pt; margin-bottom: 2pt; }
  .cf-header h1 .cf-name-first { color: inherit; }
  .cf-header h1 .cf-name-last { color: inherit; opacity: 0.75; margin-left: 0.28em; }
  .cf-header .cf-job-title { font-size: 11pt; font-weight: 400; opacity: 0.9; margin-bottom: 10pt; }
  .cf-header .cf-contact { display: flex; flex-wrap: wrap; gap: 8pt; font-size: 8.5pt; opacity: 0.9; }
  .cf-header .cf-contact span::before { content: ''; }
  .cf-header .cf-contact span + span::before { content: '·'; margin-right: 8pt; }
  .cf-body { padding: 16pt 24pt; }
  .cf-section { margin-bottom: 14pt; break-inside: avoid-page; }
  .cf-section-title { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1pt; color: var(--accent, #4f46e5); border-bottom: 1.5pt solid var(--accent, #4f46e5); padding-bottom: 3pt; margin-bottom: 10pt; }
  .cf-entry { margin-bottom: 9pt; break-inside: avoid; }
  .cf-entry-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1pt; }
  .cf-entry-primary { font-weight: 600; font-size: 10.5pt; }
  .cf-entry-secondary { font-size: 9.5pt; color: #444; }
  .cf-entry-date { font-size: 8.5pt; color: #666; white-space: nowrap; margin-left: 8pt; }
  .cf-entry p { font-size: 9.5pt; color: #333; margin-top: 2pt; }
  .cf-skills-list { display: flex; flex-wrap: wrap; gap: 4pt; }
  .cf-skill-tag { background: #f0f0fa; color: #4f46e5; font-size: 8.5pt; padding: 2pt 7pt; border-radius: 3pt; font-weight: 500; }
  .cf-field { font-size: 9.5pt; margin-bottom: 3pt; }
  .cf-field-label { font-weight: 600; }
  .cf-field--richtext p { margin-top: 2pt; }
  a { color: var(--accent, #4f46e5); text-decoration: none; }
`;

function renderSection(section: Section, accentColor: string): string {
  const entries = section.entries;
  if (!entries.length) return '';

  let content = '';
  const sid = section.id;

  switch (section.type) {
    case 'experience':
      content = entries
        .map((e) => {
          const title = getString(e, 'title');
          const company = getString(e, 'company');
          const location = getString(e, 'location');
          const dateRange = formatDateRange(e.values.startDate, e.values.endDate);
          const description = getString(e, 'description');
          const secondaryLine = [company, location].filter(Boolean).join(', ');
          return cfEntry(
            sid,
            e.id,
            `
              <div class="cf-entry-header">
                <div>
                  <div class="cf-entry-primary">${cfField(sid, e.id, 'title', escapeHtml(title))}</div>
                  ${secondaryLine ? `<div class="cf-entry-secondary">${escapeHtml(secondaryLine)}</div>` : ''}
                </div>
                ${dateRange ? `<div class="cf-entry-date">${escapeHtml(dateRange)}</div>` : ''}
              </div>
              ${description ? cfField(sid, e.id, 'description', richTextToHtml(description)) : ''}`,
            'cf-entry',
          );
        })
        .join('');
      break;

    case 'education':
      content = entries
        .map((e) => {
          const degree = getString(e, 'degree');
          const school = getString(e, 'school');
          const dateRange = formatDateRange(e.values.startDate, e.values.endDate);
          return cfEntry(
            sid,
            e.id,
            `
              <div class="cf-entry-header">
                <div>
                  <div class="cf-entry-primary">${cfField(sid, e.id, 'degree', escapeHtml(degree))}</div>
                  ${school ? `<div class="cf-entry-secondary">${escapeHtml(school)}</div>` : ''}
                </div>
                ${dateRange ? `<div class="cf-entry-date">${escapeHtml(dateRange)}</div>` : ''}
              </div>`,
            'cf-entry',
          );
        })
        .join('');
      break;

    case 'skills':
      // Tag list, not a click-to-edit field (see the note above cfField) —
      // still wrapped per-entry so each tag can be deleted individually.
      content = `<div class="cf-skills-list">${entries.map((e) => cfEntry(sid, e.id, `<span class="cf-skill-tag">${escapeHtml(getString(e, 'name'))}</span>`, '')).join('')}</div>`;
      break;

    case 'certifications':
      content = entries
        .map((e) => {
          const name = getString(e, 'name');
          const issuer = getString(e, 'issuer');
          const date = formatDate(getString(e, 'date'));
          return cfEntry(
            sid,
            e.id,
            `<div class="cf-entry-header"><div><div class="cf-entry-primary">${cfField(sid, e.id, 'name', escapeHtml(name))}</div>${issuer ? `<div class="cf-entry-secondary">${escapeHtml(issuer)}</div>` : ''}</div>${date ? `<div class="cf-entry-date">${escapeHtml(date)}</div>` : ''}</div>`,
            'cf-entry',
          );
        })
        .join('');
      break;

    case 'projects':
      content = entries
        .map((e) => {
          const name = getString(e, 'name');
          const description = getString(e, 'description');
          const url = getString(e, 'url');
          return cfEntry(
            sid,
            e.id,
            `<div class="cf-entry-primary">${cfField(sid, e.id, 'name', escapeHtml(name))}${url ? ` <a href="${escapeHtml(url)}" style="font-size:8.5pt;font-weight:400">${escapeHtml(url)}</a>` : ''}</div>${description ? cfField(sid, e.id, 'description', richTextToHtml(description)) : ''}`,
            'cf-entry',
          );
        })
        .join('');
      break;

    case 'languages':
      content = entries
        .map((e) => {
          const name = getString(e, 'name');
          const proficiency = getString(e, 'proficiency');
          return cfEntry(
            sid,
            e.id,
            `<span class="cf-entry-primary">${cfField(sid, e.id, 'name', escapeHtml(name))}</span>${proficiency ? `<span class="cf-entry-secondary"> — ${escapeHtml(proficiency)}</span>` : ''}`,
            'cf-entry',
          );
        })
        .join('');
      break;

    case 'references':
      content = entries
        .map((e) => {
          const name = getString(e, 'name');
          const relationship = getString(e, 'relationship');
          const contact = getString(e, 'contact');
          return cfEntry(
            sid,
            e.id,
            `<div class="cf-entry-primary">${cfField(sid, e.id, 'name', escapeHtml(name))}</div>${relationship ? `<div class="cf-entry-secondary">${escapeHtml(relationship)}</div>` : ''}${contact ? `<div class="cf-entry-secondary">${escapeHtml(contact)}</div>` : ''}`,
            'cf-entry',
          );
        })
        .join('');
      break;

    default:
      // Custom sections: generic field renderer — this is the "automatically
      // renders custom sections" guarantee. No template-level code change needed.
      content = entries.map((e) => cfEntry(sid, e.id, renderEntryFieldsGeneric(sid, e, section.fields), 'cf-entry')).join('');
      break;
  }

  return `
    <div class="cf-section">
      ${cfSectionTitle(sid, escapeHtml(section.title))}
      ${content}
    </div>`;
}

function renderHtml(resume: Resume): string {
  const info = getPersonalInfo(resume);
  const accent = resume.theme.accentColor || '#4f46e5';
  const bodySections = getBodySections(resume);
  const summaryText = getSummaryText(resume);
  const summaryRef = getSummaryRef(resume);

  const contactParts: Array<{ key: string; value: string }> = [
    { key: 'email', value: info.email },
    { key: 'phone', value: info.phone },
    { key: 'location', value: info.location },
    { key: 'linkedin', value: info.linkedin },
    { key: 'website', value: info.website },
  ].filter((p) => p.value);

  const wrapHeaderField = (fieldKey: string, html: string) =>
    summaryRef ? cfField(summaryRef.sectionId, summaryRef.entryId, fieldKey, html) : html;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(info.fullName || `${info.firstName} ${info.lastName}`.trim())}</title>
  <style>
    ${PRINT_CSS.replace(/var\(--accent, #4f46e5\)/g, accent).replace(/color: #4f46e5/g, `color: ${accent}`).replace(/background: #f0f0fa/g, `background: ${accent}18`)}
  </style>
</head>
<body>
  <div class="cf-page">
    <div class="cf-header">
      <h1>${
        info.firstName || info.lastName
          ? `${wrapHeaderField('firstName', `<span class="cf-name-first">${escapeHtml(info.firstName)}</span>`)}${
              info.lastName ? ' ' : ''
            }${wrapHeaderField('lastName', `<span class="cf-name-last">${escapeHtml(info.lastName)}</span>`)}`
          : cfField(CF_TITLE_SECTION_ID, CF_TITLE_ENTRY_ID, CF_TITLE_FIELD_KEY, escapeHtml(info.fullName))
      }</h1>
      ${info.jobTitle ? `<div class="cf-job-title">${wrapHeaderField('jobTitle', escapeHtml(info.jobTitle))}</div>` : ''}
      ${contactParts.length ? `<div class="cf-contact">${contactParts.map((p) => `<span>${wrapHeaderField(p.key, escapeHtml(p.value))}</span>`).join('')}</div>` : ''}
    </div>
    <div class="cf-body">
      ${summaryText ? `<div class="cf-section"><div class="cf-section-title">Summary</div><div class="cf-field--richtext">${wrapHeaderField('text', richTextToHtml(summaryText))}</div></div>` : ''}
      ${bodySections.map((s) => renderSection(s, accent)).join('')}
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

  const headerParagraphs = [
    new Paragraph({
      children:
        info.firstName || info.lastName
          ? [
              new TextRun({ text: info.firstName, bold: true, size: 44, color: 'FFFFFF' }),
              ...(info.lastName
                ? [new TextRun({ text: ` ${info.lastName}`, bold: true, size: 44, color: 'DDDDFF' })]
                : []),
            ]
          : [new TextRun({ text: info.fullName, bold: true, size: 44, color: 'FFFFFF' })],
      shading: { type: ShadingType.SOLID, color: '4F46E5', fill: '4F46E5' },
    }),
    ...(info.jobTitle
      ? [
          new Paragraph({
            children: [new TextRun({ text: info.jobTitle, size: 22, color: 'DDDDFF' })],
            shading: { type: ShadingType.SOLID, color: '4F46E5', fill: '4F46E5' },
          }),
        ]
      : []),
    new Paragraph({
      children: [
        new TextRun({
          text: [info.email, info.phone, info.location].filter(Boolean).join('  ·  '),
          size: 18,
          color: 'DDDDFF',
        }),
      ],
      shading: { type: ShadingType.SOLID, color: '4F46E5', fill: '4F46E5' },
    }),
    new Paragraph({ text: '' }),
  ];

  const sectionParagraphs: Paragraph[] = [];

  if (summaryText) {
    sectionParagraphs.push(
      new Paragraph({
        text: 'SUMMARY',
        heading: HeadingLevel.HEADING_2,
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '4F46E5' } },
      }),
    );
    summaryText.split('\n').filter(Boolean).forEach((line) => {
      sectionParagraphs.push(new Paragraph({ text: line }));
    });
  }

  for (const section of bodySections) {
    if (!section.entries.length) continue;

    sectionParagraphs.push(
      new Paragraph({
        text: section.title.toUpperCase(),
        heading: HeadingLevel.HEADING_2,
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '4F46E5' } },
      }),
    );

    for (const entry of section.entries) {
      switch (section.type) {
        case 'experience': {
          const title = getString(entry, 'title');
          const company = getString(entry, 'company');
          const location = getString(entry, 'location');
          const dateRange = formatDateRange(entry.values.startDate, entry.values.endDate);
          const description = getString(entry, 'description');

          sectionParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: title, bold: true, size: 22 }),
                ...(company ? [new TextRun({ text: `  ${[company, location].filter(Boolean).join(', ')}`, size: 20, color: '555555' })] : []),
                ...(dateRange ? [new TextRun({ text: `  ${dateRange}`, size: 18, color: '777777' })] : []),
              ],
            }),
          );
          if (description) {
            description.split('\n').filter(Boolean).forEach((line) => {
              sectionParagraphs.push(new Paragraph({ text: line, bullet: { level: 0 }, style: 'ListParagraph' }));
            });
          }
          break;
        }

        case 'education': {
          const degree = getString(entry, 'degree');
          const school = getString(entry, 'school');
          const dateRange = formatDateRange(entry.values.startDate, entry.values.endDate);
          sectionParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: degree, bold: true, size: 22 }),
                ...(school ? [new TextRun({ text: `  ${school}`, size: 20, color: '555555' })] : []),
                ...(dateRange ? [new TextRun({ text: `  ${dateRange}`, size: 18, color: '777777' })] : []),
              ],
            }),
          );
          break;
        }

        case 'skills': {
          const name = getString(entry, 'name');
          sectionParagraphs.push(new Paragraph({ text: `• ${name}`, indent: { left: 360 } }));
          break;
        }

        case 'certifications': {
          const name = getString(entry, 'name');
          const issuer = getString(entry, 'issuer');
          const date = formatDate(getString(entry, 'date'));
          sectionParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: name, bold: true, size: 22 }),
                ...(issuer ? [new TextRun({ text: `  ${issuer}`, size: 20, color: '555555' })] : []),
                ...(date ? [new TextRun({ text: `  ${date}`, size: 18, color: '777777' })] : []),
              ],
            }),
          );
          break;
        }

        case 'projects': {
          const name = getString(entry, 'name');
          const description = getString(entry, 'description');
          sectionParagraphs.push(new Paragraph({ children: [new TextRun({ text: name, bold: true })] }));
          if (description) {
            sectionParagraphs.push(new Paragraph({ text: description }));
          }
          break;
        }

        case 'languages': {
          const name = getString(entry, 'name');
          const proficiency = getString(entry, 'proficiency');
          sectionParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: name, bold: true }),
                ...(proficiency ? [new TextRun({ text: ` — ${proficiency}` })] : []),
              ],
            }),
          );
          break;
        }

        default: {
          // Generic fallback for custom sections — all fields rendered
          for (const field of section.fields) {
            const val = entry.values[field.key];
            if (!val) continue;
            sectionParagraphs.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `${field.label}: `, bold: true }),
                  new TextRun({ text: Array.isArray(val) ? val.join(', ') : String(val) }),
                ],
              }),
            );
          }
          break;
        }
      }

      sectionParagraphs.push(new Paragraph({ text: '' }));
    }
  }


  const doc = new Document({
    sections: [
      {
        children: [...headerParagraphs, ...sectionParagraphs],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

export const modernTemplate: TemplateRenderer = {
  id: 'modern',
  name: 'Modern',
  category: 'free',
  family: 'modern',
  previewClass: 'template-modern',
  renderHtml,
  buildDocx,
};