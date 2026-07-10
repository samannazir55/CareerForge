import type { Resume } from '@careerforge/schema';

/**
 * Hardcoded sample resume used anywhere we need to show what a template
 * looks like with realistic data, without a real user's resume on hand:
 *   - POST /admin/templates/preview (admin authoring a template)
 *   - GET /templates/:id/preview (marketplace "what am I paying for" preview)
 *
 * Previously this object was defined inline inside admin.routes.ts, which
 * meant the marketplace preview endpoint would have had to duplicate it
 * (and the two would inevitably drift). Single source of truth now.
 */
export const SAMPLE_RESUME: Resume = {
  id: 'preview',
  ownerId: '',
  title: 'Alex Morgan',
  theme: { templateId: 'preview', accentColor: '#6366f1', fontFamily: 'Inter' },
  schemaVersion: 1,
  migrationVersion: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  sections: [
    {
      id: 's1', type: 'summary', title: 'Summary', order: 0, fields: [], entries: [{
        id: 'e1', values: {
          jobTitle: 'Senior Software Engineer', email: 'alex.morgan@email.com',
          phone: '+1 (555) 234-5678', location: 'San Francisco, CA',
          linkedin: 'linkedin.com/in/alexmorgan', website: 'alexmorgan.dev',
          text: 'Full-stack engineer with 7+ years building scalable web products. Passionate about clean architecture and shipping software users love.',
        },
      }],
    },
    {
      id: 's2', type: 'experience', title: 'Experience', order: 1, fields: [], entries: [
        { id: 'e2', values: { title: 'Senior Software Engineer', company: 'Stripe', location: 'San Francisco, CA', startDate: '2021-06', endDate: '', description: 'Led development of the next-generation payments dashboard serving 2M+ merchants.\nReduced API latency by 40% through query optimisation.' } },
        { id: 'e3', values: { title: 'Software Engineer', company: 'Accenture', location: 'New York, NY', startDate: '2018-08', endDate: '2021-05', description: 'Built microservices architecture for a Fortune 500 retail client.' } },
      ],
    },
    {
      id: 's3', type: 'education', title: 'Education', order: 2, fields: [], entries: [
        { id: 'e4', values: { degree: 'B.S. Computer Science', school: 'Carnegie Mellon University', startDate: '2014-09', endDate: '2018-05' } },
      ],
    },
    {
      id: 's4', type: 'skills', title: 'Skills', order: 3, fields: [], entries: [
        { id: 'e5', values: { name: 'TypeScript / JavaScript' } },
        { id: 'e6', values: { name: 'React & Next.js' } },
        { id: 'e7', values: { name: 'Node.js' } },
        { id: 'e8', values: { name: 'PostgreSQL' } },
        { id: 'e9', values: { name: 'AWS' } },
      ],
    },
    {
      id: 's5', type: 'certifications', title: 'Certifications', order: 4, fields: [], entries: [
        { id: 'e10', values: { name: 'AWS Certified Solutions Architect', issuer: 'Amazon Web Services', date: '2023-06' } },
      ],
    },
    {
      id: 's6', type: 'projects', title: 'Projects', order: 5, fields: [], entries: [
        { id: 'e11', values: { name: 'OpenPay', description: 'Open-source payments SDK with 3k+ GitHub stars.', url: 'github.com/alexmorgan/openpay' } },
      ],
    },
    {
      id: 's7', type: 'languages', title: 'Languages', order: 6, fields: [], entries: [
        { id: 'e12', values: { name: 'English', proficiency: 'Native' } },
        { id: 'e13', values: { name: 'Spanish', proficiency: 'Professional working proficiency' } },
      ],
    },
    {
      id: 's8', type: 'references', title: 'References', order: 7, fields: [], entries: [
        { id: 'e14', values: { name: 'Jordan Lee', relationship: 'Former Manager, Stripe', contact: 'jordan.lee@email.com' } },
      ],
    },
    {
      id: 's9', type: 'custom', title: 'Volunteering', order: 8,
      fields: [
        { key: 'org', label: 'Organization', kind: 'text', required: false },
        { key: 'role', label: 'Role', kind: 'text', required: false },
      ],
      entries: [{ id: 'e15', values: { org: 'Code.org', role: 'Volunteer Mentor' } }],
    },
  ],
} as unknown as Resume;
