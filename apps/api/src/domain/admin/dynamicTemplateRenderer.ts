import type { Resume } from '@careerforge/schema';

// ---------------------------------------------------------------------------
// Dynamic template renderer
// ---------------------------------------------------------------------------
// Dynamic templates are HTML strings stored in the database with a simple
// placeholder syntax that this renderer fills in from a Resume object.
//
// PLACEHOLDER SYNTAX
// ──────────────────
// Scalars (replaced with escaped text):
//   {{name}}      {{jobTitle}}   {{email}}     {{phone}}
//   {{location}}  {{linkedin}}   {{website}}   {{summary}}
//
// Loop blocks (inner template repeated per entry):
//   {{#experiences}} ... {{/experiences}}
//     inner vars: {{exp.title}}  {{exp.company}}  {{exp.location}}
//                 {{exp.dateRange}}  {{exp.description}}
//
//   {{#education}} ... {{/education}}
//     inner vars: {{edu.degree}}  {{edu.school}}  {{edu.dateRange}}
//
//   {{#skills}} ... {{/skills}}
//     inner var: {{skill.name}}
//
// Conditional blocks (renders inner content only when value is non-empty):
//   {{#if name}} ... {{/if name}}
// ---------------------------------------------------------------------------

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Replace {{key}} tokens in a snippet using a flat string map. */
function interpolate(snippet: string, vars: Record<string, string>): string {
  return snippet.replace(/\{\{([\w.]+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? vars[key] : '',
  );
}

function fmtDate(ym?: string): string {
  if (!ym) return '';
  const [year, month] = ym.split('-');
  if (!year) return '';
  if (!month) return year;
  const d = new Date(Number(year), Number(month) - 1);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function dateRange(start?: string, end?: string): string {
  const s = fmtDate(start);
  const e = end ? fmtDate(end) : 'Present';
  return s ? `${s} – ${e}` : e;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function renderDynamicTemplate(templateHtml: string, resume: Resume): string {
  // ── Personal info ─────────────────────────────────────────────────────────
  const summarySection = resume.sections.find((s) => s.type === 'summary');
  const sv = (summarySection?.entries[0]?.values ?? {}) as Record<string, string>;

  const scalars: Record<string, string> = {
    name:     escHtml(resume.title ?? ''),
    jobTitle: escHtml(sv.jobTitle ?? ''),
    email:    escHtml(sv.email    ?? ''),
    phone:    escHtml(sv.phone    ?? ''),
    location: escHtml(sv.location ?? ''),
    linkedin: escHtml(sv.linkedin ?? ''),
    website:  escHtml(sv.website  ?? ''),
    // summary text may contain basic HTML; don't double-escape it
    summary:  sv.text ?? '',
  };

  let out = templateHtml;

  // ── Scalar substitution ───────────────────────────────────────────────────
  for (const [k, v] of Object.entries(scalars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }

  // ── Conditionals  {{#if key}} ... {{/if key}} ─────────────────────────────
  out = out.replace(
    /\{\{#if ([\w.]+)\}\}([\s\S]*?)\{\{\/if \1\}\}/g,
    (_, key, inner) => (scalars[key] ? inner : ''),
  );

  // ── {{#experiences}} ... {{/experiences}} ────────────────────────────────
  const expSection = resume.sections.find((s) => s.type === 'experience');
  out = out.replace(
    /\{\{#experiences?\}\}([\s\S]*?)\{\{\/experiences?\}\}/g,
    (_, tmpl) => {
      if (!expSection?.entries.length) return '';
      return expSection.entries
        .map((e) => {
          const v = (e.values ?? {}) as Record<string, string>;
          return interpolate(tmpl, {
            'exp.title':       escHtml(v.title    ?? ''),
            'exp.company':     escHtml(v.company  ?? ''),
            'exp.location':    escHtml(v.location ?? ''),
            'exp.startDate':   fmtDate(v.startDate),
            'exp.endDate':     v.endDate ? fmtDate(v.endDate) : 'Present',
            'exp.dateRange':   dateRange(v.startDate, v.endDate),
            // description may contain \n — convert to <br> for HTML output
            'exp.description': (v.description ?? '').replace(/\n/g, '<br>'),
          });
        })
        .join('');
    },
  );

  // ── {{#education}} ... {{/education}} ────────────────────────────────────
  const eduSection = resume.sections.find((s) => s.type === 'education');
  out = out.replace(
    /\{\{#education\}\}([\s\S]*?)\{\{\/education\}\}/g,
    (_, tmpl) => {
      if (!eduSection?.entries.length) return '';
      return eduSection.entries
        .map((e) => {
          const v = (e.values ?? {}) as Record<string, string>;
          return interpolate(tmpl, {
            'edu.degree':    escHtml(v.degree ?? ''),
            'edu.school':    escHtml(v.school ?? ''),
            'edu.startDate': fmtDate(v.startDate),
            'edu.endDate':   v.endDate ? fmtDate(v.endDate) : '',
            'edu.dateRange': dateRange(v.startDate, v.endDate === '' ? undefined : v.endDate),
          });
        })
        .join('');
    },
  );

  // ── {{#skills}} ... {{/skills}} ──────────────────────────────────────────
  const skillsSection = resume.sections.find((s) => s.type === 'skills');
  out = out.replace(
    /\{\{#skills\}\}([\s\S]*?)\{\{\/skills\}\}/g,
    (_, tmpl) => {
      if (!skillsSection?.entries.length) return '';
      return skillsSection.entries
        .map((e) => {
          const v = (e.values ?? {}) as Record<string, string>;
          return interpolate(tmpl, { 'skill.name': escHtml(v.name ?? '') });
        })
        .join('');
    },
  );

  return out;
}
