import { FeaturePageLayout, type FeaturePageContent } from './FeaturePageLayout';

const content: FeaturePageContent = {
  slug: 'ats-checker',
  title: 'ATS Resume Checker',
  tagline: "See exactly what's stopping your resume from passing ATS filters.",
  seoDescription:
    'Corvyx\u2019s ATS Resume Checker scores a resume against a job description, flags missing keywords and sections, and gives concrete fixes to improve ATS compatibility.',
  overview:
    'Most companies filter resumes through an applicant tracking system before a human ever sees them. The ATS Resume Checker scores a resume for compatibility with those systems, and — when scored against a specific job description — flags the keywords and sections that are missing, with concrete suggestions to fix them. There\u2019s also a free version at /free-ats-checker that doesn\u2019t require an account.',
  steps: [
    { title: 'Paste your resume', description: 'Use a resume already built in Corvyx, or paste raw resume text into the free checker.' },
    { title: 'Add a job description (optional)', description: 'Score against a specific listing to see exactly which keywords it\u2019s missing.' },
    { title: 'Fix what\u2019s flagged', description: 'Get a compatibility score, missing keywords, missing sections, and concrete suggestions.' },
  ],
  whoItsFor: [
    'Anyone applying to roles at companies that use applicant tracking systems',
    'People who suspect their resume isn\u2019t even reaching a human reviewer',
    'Job seekers tailoring a resume to a specific job posting',
  ],
  planNote: 'Free tier gets a basic score only — Professional and Premium include the full keyword and section breakdown.',
  secondaryCta: { label: 'Try the free checker (no account)', to: '/free-ats-checker' },
};

export function AtsCheckerPage() {
  return <FeaturePageLayout content={content} />;
}
