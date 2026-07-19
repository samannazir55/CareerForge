import { FeaturePageLayout, type FeaturePageContent } from './FeaturePageLayout';

const content: FeaturePageContent = {
  slug: 'resume-builder',
  title: 'AI Resume Builder',
  tagline: 'Build a resume by chatting — the AI drafts it live as you talk.',
  seoDescription:
    'Corvyx\u2019s AI Resume Builder writes your resume through conversation. Answer questions about your experience and watch a live preview build itself, then export to PDF or DOCX.',
  overview:
    'The AI Resume Builder asks about your experience, education, skills, and achievements one topic at a time, and turns your answers into resume content in real time. You can also import an existing resume or CV and the AI will extract your details automatically instead of starting from a blank page. Every save is versioned, so you can compare drafts or roll back to an earlier one.',
  steps: [
    { title: 'Start a conversation', description: 'Answer the AI\u2019s questions about your background, or paste in an existing resume to have it extracted automatically.' },
    { title: 'Watch it build live', description: 'Each answer updates a live preview of your resume, organized into sections — summary, experience, education, skills, and more.' },
    { title: 'Export when ready', description: 'Download a pixel-faithful PDF or Word (DOCX) export, rendered server-side so what you see is what you get.' },
  ],
  whoItsFor: [
    "Anyone starting a resume from scratch who doesn't know where to begin",
    'People who have an old resume they want rebuilt rather than reformatted by hand',
    'Job seekers who want a clean, structured resume without fighting a template editor',
  ],
  secondaryCta: { label: 'Check my resume against ATS', to: '/free-ats-checker' },
};

export function ResumeBuilderPage() {
  return <FeaturePageLayout content={content} />;
}
