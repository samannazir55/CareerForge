import { FeaturePageLayout, type FeaturePageContent } from './FeaturePageLayout';

const content: FeaturePageContent = {
  slug: 'career-coach',
  title: 'AI Career Coach',
  tagline: 'Ongoing, chat-based guidance on your career path and next moves.',
  seoDescription:
    'Corvyx\u2019s AI Career Coach gives ongoing chat-based guidance on career direction, skill gaps, and next moves, grounded in your actual resume and career profile.',
  overview:
    'The AI Career Coach is a chat-based advisor grounded in your resume and career profile, rather than a generic chatbot. Ask about career direction, whether a move makes sense, what skills to build next, or how to think about a decision — it responds with your actual background as context instead of generic advice.',
  steps: [
    { title: 'Build a career profile', description: 'Corvyx uses your resumes and profile facts as the coach\u2019s context.' },
    { title: 'Ask what\u2019s on your mind', description: 'Career direction, skill gaps, whether to make a move — ask in plain language.' },
    { title: 'Get grounded guidance', description: 'Responses reference your actual experience rather than generic career advice.' },
  ],
  whoItsFor: [
    'Anyone weighing a career change or unsure what to do next',
    'People who want a sounding board for career decisions without booking a human coach',
    'Professionals who want advice grounded in their actual background, not generic tips',
  ],
  planNote: 'AI Career Coach is a Premium feature.',
};

export function CareerCoachPage() {
  return <FeaturePageLayout content={content} />;
}
