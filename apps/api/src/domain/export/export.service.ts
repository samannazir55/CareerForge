import type { User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getBrowser } from './browser.js';
import { getTemplate, isPremiumTemplate } from '@careerforge/templates';
import { runMigrations } from '@careerforge/schema';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';

export type ExportFormat = 'pdf' | 'docx';

/**
 * Premium-gating rules, isolated here so template code never contains them:
 * - Free templates: always exportable.
 * - Premium templates: exportable only if the user has PREMIUM subscription
 *   OR has purchased the template individually.
 *
 * This check runs in the service layer before any rendering begins — a
 * premium-gated export is rejected here, not after burning CPU on rendering.
 *
 * Phase 5 Step 5 (subscriptions/payments) will populate the TemplatePurchase
 * table and set subscriptionTier properly. Until then, only free templates
 * are fully exportable, which is correct product behaviour for pre-launch.
 */
async function assertCanExport(user: User, templateId: string): Promise<void> {
  if (!isPremiumTemplate(templateId)) return; // free templates: always allowed

  if (user.subscriptionTier === 'PREMIUM') return; // premium subscribers: always allowed

  const purchase = await prisma.templatePurchase.findUnique({
    where: { userId_templateId: { userId: user.id, templateId } },
  });
  if (purchase) return;

  throw new ForbiddenError(
    'This is a premium template. Upgrade to Premium or purchase this template to download.',
    'PREMIUM_REQUIRED',
  );
}

export async function exportResume(
  resumeId: string,
  user: User,
  format: ExportFormat,
): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  const row = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!row || row.ownerId !== user.id) throw new NotFoundError('Resume not found.');

  // Run migrations in memory — the stored record is never mutated during export.
  // A resume saved under schemaVersion 1 that's requested while the app is at
  // schemaVersion 3 gets migrated on the fly to schemaVersion 3 shape for rendering,
  // but the database row still holds the original schemaVersion 1 data untouched.
  const { payload: resume } = runMigrations({
    schemaVersion: row.schemaVersion,
    migrationVersion: row.migrationVersion,
    payload: { id: row.id, ownerId: row.ownerId, title: row.title, theme: row.theme, sections: row.sections, schemaVersion: row.schemaVersion, migrationVersion: row.migrationVersion, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() },
  });

  const templateId = (resume.theme as { templateId: string }).templateId;
  await assertCanExport(user, templateId);

  const template = getTemplate(templateId);
  if (template.id !== templateId) {
    // Fallback was used — log so it's visible in monitoring
    console.warn(`Template "${templateId}" not found; fell back to "${template.id}" for resume ${resumeId}`);
  }

  if (format === 'pdf') {
    const html = template.renderHtml(resume as any);
    const buffer = await renderPdf(html);
    const filename = `${slugify(resume.title)}.pdf`;
    return { buffer, mimeType: 'application/pdf', filename };
  }

  // DOCX
  const buffer = await template.buildDocx(resume as any);
  const filename = `${slugify(resume.title)}.docx`;
  return {
    buffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    filename,
  };
}

async function renderPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // setContent is faster and more deterministic than navigating to a URL —
    // no network dependency, no race between navigation and CSS load.
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      // printBackground: true is CRITICAL — Chrome strips background colors/
      // images by default when printing. This is the single most common cause
      // of "the PDF looks blank/wrong" compared to the HTML preview.
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'resume';
}
