import { Router } from 'express';
import { exportResume } from './export.service.js';
import { requireAuth, requireVerifiedEmail } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { BadRequestError } from '../../lib/errors.js';

export const exportRouter = Router();

/**
 * GET /api/resumes/:id/export/:format
 * Streams the generated PDF or DOCX file directly to the client.
 * Both format and auth are validated before any rendering begins.
 */
exportRouter.get(
  '/:id/export/:format',
  requireAuth,
  requireVerifiedEmail,
  asyncHandler(async (req, res) => {
    const { id, format } = req.params;

    if (format !== 'pdf' && format !== 'docx') {
      throw new BadRequestError(
        `Unsupported export format: "${format}". Use "pdf" or "docx".`,
        'UNSUPPORTED_FORMAT',
      );
    }

    const { buffer, mimeType, filename } = await exportResume(id, req.user!, format);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }),
);
