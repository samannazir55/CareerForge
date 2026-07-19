import { FeaturePageLayout, type FeaturePageContent } from './FeaturePageLayout';

const content: FeaturePageContent = {
  slug: 'interview-prep',
  title: 'Interview Preparation',
  tagline: 'Practice with AI-generated questions tailored to your target role.',
  seoDescription:
    'Corvyx generates role-specific interview questions from your resume, evaluates your answers with AI feedback, and tracks your progress across practice sessions.',
  overview:
    'Interview Preparation generates a set of questions specific to the role you\u2019re targeting, based on your resume. Answer them in writing, get AI feedback on each response, and see your progress tracked across sessions so you can see where you\u2019re improving before the real interview.',
  steps: [
    { title: 'Pick a target role', description: 'Tell Corvyx the job you\u2019re preparing for, using a saved resume as context.' },
    { title: 'Answer AI-generated questions', description: 'Work through questions written for that specific role rather than a generic bank.' },
    { title: 'Get feedback and track progress', description: 'Each answer gets AI feedback, and sessions are saved so you can see improvement over time.' },
  ],
  whoItsFor: [
    'Anyone with an interview coming up who wants targeted practice, not generic tips',
    'Career changers preparing to talk about transferable experience',
    'People who prefer to rehearse answers in writing before an interview',
  ],
  planNote: 'Free tier has no interview sessions included — Professional and Premium include monthly sessions.',
};

export function InterviewPrepPage() {
  return <FeaturePageLayout content={content} />;
}
