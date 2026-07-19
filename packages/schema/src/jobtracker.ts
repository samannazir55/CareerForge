import { z } from 'zod';

// Mirrors the `ApplicationStatus` enum on the Prisma `JobApplication` model
// (apps/api/prisma/schema.prisma).
export const JobApplicationStatusSchema = z.enum([
  'SAVED',
  'APPLIED',
  'PHONE_SCREEN',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'WITHDRAWN',
]);
export type JobApplicationStatus = z.infer<typeof JobApplicationStatusSchema>;

// Wire/response shape. Field names are the tracker-facing API contract —
// the service layer maps to/from the underlying `company`/`role`/`url`
// Prisma column names.
export const JobApplicationSchema = z.object({
  id: z.string().uuid(),
  companyName: z.string(),
  jobTitle: z.string(),
  jobUrl: z.string().nullable(),
  status: JobApplicationStatusSchema,
  notes: z.string().nullable(),
  appliedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type JobApplication = z.infer<typeof JobApplicationSchema>;

export const CreateJobApplicationRequestSchema = z.object({
  companyName: z.string().trim().min(1, 'companyName is required.').max(200),
  jobTitle: z.string().trim().min(1, 'jobTitle is required.').max(200),
  jobUrl: z.string().trim().url('jobUrl must be a valid URL.').max(2000).optional(),
  status: JobApplicationStatusSchema.optional(),
  notes: z.string().trim().max(10_000).optional(),
  appliedAt: z.string().datetime().optional(),
});
export type CreateJobApplicationRequest = z.infer<typeof CreateJobApplicationRequestSchema>;

// PATCH — every field optional, but at least one must be present.
export const UpdateJobApplicationRequestSchema = z
  .object({
    companyName: z.string().trim().min(1, 'companyName cannot be empty.').max(200),
    jobTitle: z.string().trim().min(1, 'jobTitle cannot be empty.').max(200),
    jobUrl: z.string().trim().url('jobUrl must be a valid URL.').max(2000).nullable(),
    status: JobApplicationStatusSchema,
    notes: z.string().trim().max(10_000).nullable(),
    appliedAt: z.string().datetime().nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided.',
  });
export type UpdateJobApplicationRequest = z.infer<typeof UpdateJobApplicationRequestSchema>;

export const ListJobApplicationsQuerySchema = z.object({
  status: JobApplicationStatusSchema.optional(),
});
export type ListJobApplicationsQuery = z.infer<typeof ListJobApplicationsQuerySchema>;
