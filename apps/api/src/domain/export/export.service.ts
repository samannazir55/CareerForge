import type { User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getBrowser } from './browser.js';
import { resolveTemplate, type ResolvedTemplate } from '../templates/templateResolver.js';
import { runMigrations } from '@careerforge/schema';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../lib/errors.js';

export type ExportFormat = 'pdf' | 'docx';

/**
 * Premium-gating rules, isolated here so template code never contains them:
 * - Free templates: always exportable.
 * - Premium templates: exportable only if the user has a paid subscription
 *   (PROFESSIONAL or PREMIUM) OR has purchased the template individually.
 *
 * This check runs in the service layer before any rendering begins — a
 * premium-gated export is rejected here, not after burning CPU on rendering.
 *
 * Uses the resolved template's `isPremium` flag (which understands BOTH
 * code-registered templates AND admin-created DynamicTemplate rows) rather
 * than the code-registry-only `isPremiumTemplate()` — previously, a premium
 * dynamic template's cost was silently bypassed here because that helper
 * always returned false for any id outside the code registry, meaning a
 * "premium" AI-generated template was actually downloadable by anyone for
 * free.
 */
async function assertCanExport(user: User, template: ResolvedTemplate): Promise<void> {
  if (!template.isPremium) return; // free templates: always allowed

  // Admins can download any template, free or premium, without a
  // subscription or points — needed to actually test what gets shipped
  // (including AI-generated templates created in the admin panel) without
  // burning real points or needing a paid plan on the admin's own account.
  if (user.role === 'ADMIN') return;

  // Any paid tier unlocks every premium template — PREMIUM was previously
  // the only tier checked here, which meant a PROFESSIONAL subscriber (a
  // paying customer) was denied downloads the same as a free user.
  if (user.subscriptionTier === 'PREMIUM' || user.subscriptionTier === 'PROFESSIONAL') return;

  const purchase = await prisma.templatePurchase.findUnique({
    where: { userId_templateId: { userId: user.id, templateId: template.id } },
  });
  if (purchase) return;

  throw new ForbiddenError(
    'This is a premium template. Upgrade your plan or purchase this template to download.',
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
  const template = await resolveTemplate(templateId);
  if (template.id !== templateId) {
    // Fallback was used — log so it's visible in monitoring
    console.warn(`Template "${templateId}" not found; fell back to "${template.id}" for resume ${resumeId}`);
  }

  await assertCanExport(user, template);

  if (format === 'pdf') {
    const html = template.renderHtml(resume as any);
    const buffer = await renderPdf(html);
    const filename = `${slugify(resume.title)}.pdf`;
    return { buffer, mimeType: 'application/pdf', filename };
  }

  // DOCX — dynamic (AI/admin-generated) templates are arbitrary HTML/CSS
  // with no reliable generic mapping to OOXML, so this format isn't
  // supported for them. Previously this silently fell through to
  // getTemplate()'s Modern fallback and exported a DOCX in the WRONG
  // template rather than telling the user DOCX isn't available here.
  if (!template.buildDocx) {
    throw new BadRequestError(
      'DOCX export is not available for this template yet — try PDF instead.',
      'DOCX_NOT_SUPPORTED_DYNAMIC',
    );
  }
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
    // `waitUntil: 'networkidle0'` (the previous setting) waits for there to
    // be NO in-flight network requests for 500ms — including the template's
    // `@import url('https://fonts.googleapis.com/...')`. If that request is
    // slow, blocked, or the container's outbound network is restricted,
    // networkidle0 never resolves and Puppeteer hits its 30s navigation
    // timeout, which throws and (uncaught) surfaces as a 500 on the export
    // endpoint. 'domcontentloaded' only waits for the HTML/CSS itself to be
    // parsed — it doesn't depend on any external request succeeding.
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Give web fonts a real chance to finish loading (so text isn't rendered
    // in a fallback font), but cap it — a hung/unreachable font request
    // should degrade to "wrong font" rather than fail the whole export.
    await Promise.race([
      page.evaluate(() => (globalThis as any).document.fonts?.ready).catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);

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
