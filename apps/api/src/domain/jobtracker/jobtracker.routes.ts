import { Router } from 'express';
import { requireAuth } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { BadRequestError } from '../../lib/errors.js';
import {
  CreateJobApplicationRequestSchema,
  UpdateJobApplicationRequestSchema,
  JobApplicationStatusSchema,
  type JobApplicationStatus,
} from '@careerforge/schema';
import {
  listJobApplications,
  createJobApplication,
  updateJobApplication,
  deleteJobApplication,
} from './jobtracker.service.js';

export const jobTrackerRouter = Router();

jobTrackerRouter.use(requireAuth);

/**
 * GET /api/jobs?status=APPLIED
 * Lists the authenticated user's job applications, optionally filtered by
 * status.
 */
jobTrackerRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status: rawStatus } = req.query;
    let status: JobApplicationStatus | undefined;
    if (rawStatus !== undefined) {
      if (typeof rawStatus !== 'string') {
        throw new BadRequestError('status must be a single string value.');
      }
      const parsed = JobApplicationStatusSchema.safeParse(rawStatus);
      if (!parsed.success) {
        throw new BadRequestError(`Invalid status: ${rawStatus}`);
      }
      status = parsed.data;
    }

    const jobs = await listJobApplications(req.user!.id, status);
    res.status(200).json({ jobs });
  }),
);

/**
 * POST /api/jobs
 * Body: { companyName, jobTitle, jobUrl?, status?, notes?, appliedAt? }
 */
jobTrackerRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = CreateJobApplicationRequestSchema.parse(req.body);
    const job = await createJobApplication(req.user!.id, input);
    res.status(201).json({ job });
  }),
);

/**
 * PATCH /api/jobs/:id
 * Body: any subset of { companyName, jobTitle, jobUrl, status, notes, appliedAt }
 */
jobTrackerRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = UpdateJobApplicationRequestSchema.parse(req.body);
    const job = await updateJobApplication(req.user!.id, req.params.id, input);
    res.status(200).json({ job });
  }),
);

/**
 * DELETE /api/jobs/:id
 */
jobTrackerRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteJobApplication(req.user!.id, req.params.id);
    res.status(200).json({ success: true });
  }),
);
