import { FeaturePageLayout, type FeaturePageContent } from './FeaturePageLayout';

const content: FeaturePageContent = {
  slug: 'linkedin-optimizer',
  title: 'LinkedIn Profile Optimizer',
  tagline: 'Turn your resume into a profile that actually gets recruiter attention.',
  seoDescription:
    'Corvyx\u2019s LinkedIn Optimizer rewrites your headline, About section, and experience bullets from your resume to improve recruiter search visibility.',
  overview:
    'The LinkedIn Optimizer takes an existing resume and rewrites the parts of a LinkedIn profile that matter most for being found: your headline, About section, and experience bullets. You can also target it at a specific role you\u2019re aiming for, so the language it produces matches how recruiters search for that role.',
  steps: [
    { title: 'Start from a resume', description: 'Pick a resume already built in Corvyx as the source material.' },
    { title: 'Optionally target a role', description: 'Add the role you want your profile to read well for, and the rewrite leans into that.' },
    { title: 'Copy the results into LinkedIn', description: 'Get rewritten headline, About, and experience copy to paste directly into your profile.' },
  ],
  whoItsFor: [
    'Anyone whose LinkedIn profile is years out of date',
    'People actively job-searching who want to show up in recruiter searches',
    'Professionals who have a strong resume but a thin or generic LinkedIn presence',
  ],
  planNote: 'LinkedIn Optimizer is a Premium feature.',
};

export function LinkedInOptimizerPage() {
  return <FeaturePageLayout content={content} />;
}
