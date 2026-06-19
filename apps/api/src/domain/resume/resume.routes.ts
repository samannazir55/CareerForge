import { Router } from 'express';
import {
  CreateResumeRequestSchema,
  UpdateResumeRequestSchema,
  CreateVersionRequestSchema,
} from '@careerforge/schema';
import * as resumeService from './resume.service.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth, requireVerifiedEmail } from '../../middleware/authGuard.js';
import { BadRequestError } from '../../lib/errors.js';

export const resumeRouter = Router();

// Every route here requires a verified account — this is the first real
// usage of requireVerifiedEmail, defined back in the Auth phase for exactly
// this purpose ("verification required before access").
resumeRouter.use(requireAuth, requireVerifiedEmail);

resumeRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { title } = CreateResumeRequestSchema.parse(req.body);
    const resume = await resumeService.createResume(req.user!.id, title);
    res.status(201).json({ resume });
  }),
);

resumeRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const resumes = await resumeService.listResumes(req.user!.id);
    res.status(200).json({ resumes });
  }),
);

resumeRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const resume = await resumeService.getResume(req.params.id, req.user!.id);
    res.status(200).json({ resume });
  }),
);

resumeRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const patch = UpdateResumeRequestSchema.parse(req.body);
    const resume = await resumeService.updateResume(req.params.id, req.user!.id, patch);
    res.status(200).json({ resume });
  }),
);

resumeRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await resumeService.deleteResume(req.params.id, req.user!.id);
    res.status(204).send();
  }),
);

// --- Version history ---------------------------------------------------------

resumeRouter.post(
  '/:id/versions',
  asyncHandler(async (req, res) => {
    const { label } = CreateVersionRequestSchema.parse(req.body ?? {});
    const version = await resumeService.createVersion(req.params.id, req.user!.id, label);
    res.status(201).json({ version });
  }),
);

resumeRouter.get(
  '/:id/versions',
  asyncHandler(async (req, res) => {
    const versions = await resumeService.listVersions(req.params.id, req.user!.id);
    res.status(200).json({ versions });
  }),
);

resumeRouter.get(
  '/:id/versions/:versionId',
  asyncHandler(async (req, res) => {
    const version = await resumeService.getVersion(req.params.id, req.params.versionId, req.user!.id);
    res.status(200).json({ version });
  }),
);

resumeRouter.post(
  '/:id/versions/:versionId/restore',
  asyncHandler(async (req, res) => {
    const resume = await resumeService.restoreVersion(req.params.id, req.params.versionId, req.user!.id);
    res.status(200).json({ resume });
  }),
);

resumeRouter.get(
  '/:id/versions/:versionAId/compare/:versionBId',
  asyncHandler(async (req, res) => {
    const { versionAId, versionBId } = req.params;
    if (!versionAId || !versionBId) {
      throw new BadRequestError('Both version ids are required.', 'MISSING_VERSION_IDS');
    }
    const diff = await resumeService.compareVersions(req.params.id, versionAId, versionBId, req.user!.id);
    res.status(200).json({ diff });
  }),
);
