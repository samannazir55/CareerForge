import { FeaturePageLayout, type FeaturePageContent } from './FeaturePageLayout';

const content: FeaturePageContent = {
  slug: 'job-tracker',
  title: 'Job Application Tracker',
  tagline: 'One board for every application, from wishlist to offer.',
  seoDescription:
    'Track every job application on a kanban board through Wishlist, Applied, Interview, and Offer stages, with real job listings you can add in one click.',
  overview:
    'The Job Application Tracker is a kanban board that holds every application you\u2019re working, moved through Wishlist, Applied, Interview, and Offer stages as things progress. It pairs with Job Search, which surfaces real job listings you can add to the tracker in one click and tailor a resume for on the spot.',
  steps: [
    { title: 'Add applications', description: 'Add roles manually, or pull them in directly from Job Search results with one click.' },
    { title: 'Move them through stages', description: 'Drag each application across Wishlist, Applied, Interview, and Offer as your search progresses.' },
    { title: 'Keep everything in one place', description: 'See your whole pipeline at a glance instead of a spreadsheet or scattered browser tabs.' },
  ],
  whoItsFor: [
    'Anyone applying to more than a handful of jobs at once',
    'People who\u2019ve lost track of what they applied to and when',
    'Job seekers who want their search organized without building their own spreadsheet',
  ],
  planNote: 'Free tier includes a limited number of tracked applications — Professional and Premium are unlimited.',
};

export function JobTrackerPage() {
  return <FeaturePageLayout content={content} />;
}
