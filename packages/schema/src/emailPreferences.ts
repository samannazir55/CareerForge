import { z } from 'zod';

export const EmailPreferenceSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  weeklyDigest: z.boolean(),
  resumeViewAlerts: z.boolean(),
  jobApplicationReminders: z.boolean(),
  interviewReminders: z.boolean(),
  marketingEmails: z.boolean(),
  updatedAt: z.string().datetime(),
});
export type EmailPreference = z.infer<typeof EmailPreferenceSchema>;

export const UpdateEmailPreferenceRequestSchema = z
  .object({
    weeklyDigest: z.boolean(),
    resumeViewAlerts: z.boolean(),
    jobApplicationReminders: z.boolean(),
    interviewReminders: z.boolean(),
    marketingEmails: z.boolean(),
  })
  .partial();
export type UpdateEmailPreferenceRequest = z.infer<typeof UpdateEmailPreferenceRequestSchema>;
