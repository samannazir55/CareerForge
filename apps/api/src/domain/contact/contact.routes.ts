import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/authGuard.js';
import { BadRequestError } from '../../lib/errors.js';
import { uploadContactScreenshot } from '../uploads/cloudinary.service.js';
import { notifyAdminOfSubmission, listSubmissionsForUser } from './contact.service.js';

// Memory storage — screenshots are small (capped at 10MB, see
// cloudinary.service.ts) and go straight to Cloudinary, never touching
// this server's disk. Same pattern as resume.routes.ts's photo upload.
const screenshotUpload = multer({ storage: multer.memoryStorage() });

export const contactRouter = Router();
contactRouter.use(requireAuth);

const SubmitContactSchema = z.object({
  type: z.enum(['SUGGESTION', 'BUG_REPORT']),
  subject: z.string().trim().min(1, 'Subject is required.').max(200),
  message: z.string().trim().min(1, 'Message is required.').max(5000),
});

contactRouter.post(
  '/',
  screenshotUpload.single('screenshot'),
  asyncHandler(async (req, res) => {
    const parsed = SubmitContactSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid submission.');
    }
    const { type, subject, message } = parsed.data;

    // Generate the id upfront (rather than letting Prisma's @default(uuid())
    // assign one on insert) so the same id can be used as the Cloudinary
    // public_id — keeping one submission's screenshot trivially findable
    // from its row without a separate lookup table.
    const id = randomUUID();

    let screenshotUrl: string | null = null;
    if (req.file) {
      const uploaded = await uploadContactScreenshot(req.file.buffer, req.file.mimetype, req.user!.id, id);
      screenshotUrl = uploaded.url;
    }

    const submission = await prisma.contactSubmission.create({
      data: { id, userId: req.user!.id, type, subject, message, screenshotUrl },
    });

    // Best-effort — the submission is already durably stored above, so a
    // failed notification email should never fail this request.
    await notifyAdminOfSubmission(submission, req.user!);

    res.status(201).json({ submission });
  }),
);

contactRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const submissions = await listSubmissionsForUser(req.user!.id);
    res.status(200).json({ submissions });
  }),
);
